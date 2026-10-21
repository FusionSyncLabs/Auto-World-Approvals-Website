import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function absoluteAssetUrl(id: string) {
  const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "www.autoworldapprovals.com";
  const proto = (getRequestHeader("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  const safeHost = /lovableproject\.com|localhost|127\.0\.0\.1|id-preview/.test(host)
    ? "www.autoworldapprovals.com"
    : host;
  return `${proto}://${safeHost}/api/public/brand-asset/${id}.jpg?v=${Date.now()}`;
}

/** Upload a new hero image to the library. */
export const uploadHeroImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().trim().min(1).max(120),
        mime: z.string(),
        dataBase64: z.string().min(20),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED_MIME.has(data.mime)) {
      throw new Error("Only JPEG, PNG, or WebP images are allowed");
    }
    // Approximate byte size from base64 length
    const approxBytes = Math.floor((data.dataBase64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      throw new Error("Image is too large (max 12 MB)");
    }
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);

    const { data: inserted, error } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "hero",
        label: data.label,
        mime: data.mime,
        data_base64: data.dataBase64,
        width: data.width ?? null,
        height: data.height ?? null,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Insert failed");
    return { ok: true, id: (inserted as { id: string }).id };
  });

const ALLOWED_SLOT_KEYS = new Set([
  "hero_image_url",
  "hero_cat_suv_url",
  "hero_cat_truck_url",
  "hero_cat_sedan_url",
  "hero_cat_ev_url",
  "hero_why_url",
]);

/** Promote a hero image to a specific slot on the homepage. */
export const setActiveHeroImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        slot: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const slot = data.slot ?? "hero_image_url";
    if (!ALLOWED_SLOT_KEYS.has(slot)) throw new Error("Invalid slot");
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);

    const { data: asset, error } = await supabaseAdmin
      .from("brand_assets")
      .select("id, kind")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !asset) throw new Error("Hero image not found");
    if ((asset as { kind: string }).kind !== "hero") throw new Error("Only hero assets can be set as the site hero");

    const url = absoluteAssetUrl(data.id);
    const { error: upErr } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: slot, value: url } as never);
    if (upErr) throw upErr;
    return { ok: true, url, slot };
  });

/** Revert a slot to the bundled default image. */
export const clearActiveHeroImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slot: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const slot = data.slot ?? "hero_image_url";
    if (!ALLOWED_SLOT_KEYS.has(slot)) throw new Error("Invalid slot");
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: slot, value: "" } as never);
    if (error) throw error;
    return { ok: true, slot };
  });

/** Delete a hero image from the library. */
export const deleteHeroImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("brand_assets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
