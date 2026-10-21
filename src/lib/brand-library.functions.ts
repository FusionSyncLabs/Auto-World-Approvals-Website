import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Build a fully-qualified URL for a brand asset, suitable for use in emails. */
function absoluteAssetUrl(id: string) {
  const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "www.autoworldapprovals.com";
  const proto = (getRequestHeader("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  const safeHost = /lovableproject\.com|localhost|127\.0\.0\.1|id-preview/.test(host)
    ? "www.autoworldapprovals.com"
    : host;
  return `${proto}://${safeHost}/api/public/brand-asset/${id}.png?v=${Date.now()}`;
}

const LIGHT_SUBJECT_PALETTES = new Set(["white_on_navy", "mono_white"]);

/**
 * Promote a generated logo to be the active site logo.
 *
 * `mode` controls which slot it fills:
 *   - "light"  → `logo_url_light` (used on light backgrounds — must be a dark/colored logo)
 *   - "dark"   → `logo_url_dark`  (used on dark backgrounds — must be a light/white logo)
 *   - "auto"   → routed based on the asset's palette
 *   - "both"   → legacy: writes both slots and `logo_url`
 */
export const setActiveLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        mode: z.enum(["light", "dark", "auto", "both"]).default("auto"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);

    const { data: asset, error } = await supabaseAdmin
      .from("brand_assets")
      .select("id, kind, palette")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !asset) throw new Error("Asset not found");
    if (asset.kind !== "logo") throw new Error("Only logo assets can be set as the site logo");

    let mode = data.mode;
    if (mode === "auto") {
      mode = LIGHT_SUBJECT_PALETTES.has(String(asset.palette ?? "")) ? "dark" : "light";
    }

    const url = absoluteAssetUrl(data.id);

    const keys: string[] = [];
    if (mode === "light" || mode === "both") keys.push("logo_url_light", "logo_url");
    if (mode === "dark" || mode === "both") keys.push("logo_url_dark");
    // Ensure logo_url (used in transactional emails) always has a sane value
    if (mode === "dark" && keys.indexOf("logo_url") === -1) {
      // only set logo_url to dark logo if no light is set
      const { data: existing } = await supabaseAdmin
        .from("app_settings").select("value").eq("key", "logo_url_light").maybeSingle();
      if (!existing?.value) keys.push("logo_url");
    }

    for (const key of Array.from(new Set(keys))) {
      const { error: upsertErr } = await supabaseAdmin
        .from("app_settings")
        .upsert({ key, value: url } as never);
      if (upsertErr) throw upsertErr;
    }

    return { ok: true, url, mode };
  });

/** Clear the active site logos and revert to the bundled default. */
export const clearActiveLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    for (const key of ["logo_url", "logo_url_light", "logo_url_dark"]) {
      const { error } = await supabaseAdmin
        .from("app_settings")
        .upsert({ key, value: "" } as never);
      if (error) throw error;
    }
    return { ok: true };
  });

/** Apply both halves of a paired logo (light + dark) to the site in one click. */
export const setActiveLogoPair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ pairId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);

    const { data: rows, error } = await supabaseAdmin
      .from("brand_assets")
      .select("id, pair_mode")
      .eq("kind", "logo")
      .eq("pair_id", data.pairId);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Logo pair not found");

    const lightId = rows.find((r) => (r as { pair_mode?: string }).pair_mode === "light")?.id as string | undefined;
    const darkId = rows.find((r) => (r as { pair_mode?: string }).pair_mode === "dark")?.id as string | undefined;
    if (!lightId && !darkId) throw new Error("Pair has no light or dark variant");

    const lightUrl = lightId ? absoluteAssetUrl(lightId) : "";
    const darkUrl = darkId ? absoluteAssetUrl(darkId) : "";

    const writes: { key: string; value: string }[] = [];
    if (lightUrl) writes.push({ key: "logo_url_light", value: lightUrl }, { key: "logo_url", value: lightUrl });
    if (darkUrl) writes.push({ key: "logo_url_dark", value: darkUrl });
    if (!lightUrl && darkUrl) writes.push({ key: "logo_url", value: darkUrl });

    for (const w of writes) {
      const { error: upErr } = await supabaseAdmin.from("app_settings").upsert(w as never);
      if (upErr) throw upErr;
    }
    return { ok: true, lightUrl, darkUrl };
  });


export const deleteBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("brand_assets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
