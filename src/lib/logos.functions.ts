import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["superadmin", "admin"])
    .limit(1);
  if (error) {
    console.error("[logos] role lookup error", JSON.stringify(error), "userId=", userId);
    throw new Error("Role check failed");
  }
  if (!data || data.length === 0) throw new Error("Forbidden");
  return supabaseAdmin;
}

const VARIANTS = {
  primary_full: {
    label: "Primary — full lockup (wordmark + mark)",
    direction:
      "Full horizontal logo lockup: a distinctive abstract icon/mark on the left and the wordmark 'AUTO WORLD APPROVALS' set in a bold, modern geometric sans on the right. Balanced spacing, optical alignment, professional kerning.",
  },
  stacked: {
    label: "Stacked — mark above wordmark",
    direction:
      "Stacked centered logo: icon/mark on top, the wordmark 'AUTO WORLD APPROVALS' centered below in a bold modern geometric sans. Two-tier hierarchy, perfectly balanced.",
  },
  icon_only: {
    label: "Icon / Mark only (app icon, favicon)",
    direction:
      "ONLY the standalone brand icon/mark — no letters, no words, no wordmark. A confident, abstract, geometric symbol suggesting forward motion, approval, and the automotive world (e.g. a stylized wheel, road, checkmark, or A/W monogram). Works as a square app icon, scales down to 32px.",
  },
  wordmark_only: {
    label: "Wordmark only (no icon)",
    direction:
      "Just the wordmark 'AUTO WORLD APPROVALS' set in a custom-feeling bold modern geometric sans-serif. Tight, confident letterspacing. No icon, no decorative elements. Single line.",
  },
  monogram: {
    label: "Monogram — 'AWA' badge",
    direction:
      "A circular or shield-style monogram badge containing the letters 'AWA' — clean, premium, custom-feeling typography. Could read as a dealership crest or fintech mark. No additional words.",
  },
} as const;

const PALETTES = {
  brand: {
    label: "Brand (navy + electric blue on white)",
    description:
      "Deep navy (#0F1B3D) and electric blue (#2D7BFF) on a pure white background. May use the brand diagonal navy → electric-blue gradient as an accent inside the mark.",
  },
  white_on_navy: {
    label: "White on navy",
    description:
      "Pure white logo on a deep navy (#0F1B3D) background. Used for dark surfaces.",
  },
  mono_black: {
    label: "Monochrome black",
    description: "100% solid black logo on a pure white background. No gradients, no secondary colors.",
  },
  mono_white: {
    label: "Monochrome white (reversed)",
    description: "100% solid white logo on a pure black background. No gradients, no secondary colors.",
  },
} as const;

export type LogoVariant = keyof typeof VARIANTS;
export type LogoPalette = keyof typeof PALETTES;

export const LOGO_VARIANTS = VARIANTS;
export const LOGO_PALETTES = PALETTES;

/**
 * Generates a PAIR of logos: identical artwork, two color treatments — one for
 * light backgrounds (dark strokes on transparency) and one for dark backgrounds
 * (light/white strokes on transparency). Both rows share a `pair_id`, and each
 * row is tagged with `pair_mode = 'light' | 'dark'`.
 *
 * Step 1: generate the LIGHT-background version (dark strokes on transparency)
 *         from text using a high-quality image model.
 * Step 2: send that image to an edit model and ask it to recolor it to white
 *         strokes on transparency, KEEPING geometry, proportions, kerning and
 *         layout pixel-identical — only colors change.
 */
export const generateLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        variant: z.enum(Object.keys(VARIANTS) as [LogoVariant, ...LogoVariant[]]),
        notes: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const variant = VARIANTS[data.variant];
    const { buildLogoSvgPair } = await import("@/lib/logo-vector.server");
    const { light, dark } = buildLogoSvgPair(data.variant);
    const basePrompt = `Production SVG logo for Auto World Approvals. Variant: ${variant.label}. ${variant.direction}`;

    // ---------- Save the pair ----------
    const pairId = crypto.randomUUID();

    const rows: { id: string; mode: "light" | "dark"; url: string }[] = [];

    const { data: lightRow, error: lightErr } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "logo",
        label: `${variant.label} — light bg`,
        variant: data.variant,
        palette: "brand",
        prompt: basePrompt.slice(0, 4000),
        mime: "image/svg+xml",
        data_base64: light.base64,
        width: light.width,
        height: light.height,
        created_by: context.userId,
        pair_id: pairId,
        pair_mode: "light",
      } as never)
      .select("id")
      .single();
    if (lightErr) throw new Error(lightErr.message);
    rows.push({ id: lightRow!.id as string, mode: "light", url: `/api/public/brand-asset/${lightRow!.id}.png` });

    const { data: darkRow, error: darkErr } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "logo",
        label: `${variant.label} — dark bg`,
        variant: data.variant,
        palette: "mono_white",
        prompt: basePrompt.slice(0, 4000),
        mime: "image/svg+xml",
        data_base64: dark.base64,
        width: dark.width,
        height: dark.height,
        created_by: context.userId,
        pair_id: pairId,
        pair_mode: "dark",
      } as never)
      .select("id")
      .single();
    if (!darkErr && darkRow) {
      rows.push({ id: darkRow.id as string, mode: "dark", url: `/api/public/brand-asset/${darkRow.id}.png` });
    } else if (darkErr) {
      console.error("[logo] save dark twin failed", darkErr);
    }

    return {
      pairId,
      label: variant.label,
      variant: data.variant,
      light: rows.find((r) => r.mode === "light")
        ? { ...rows.find((r) => r.mode === "light")!, b64: light.base64 }
        : null,
      dark: rows.find((r) => r.mode === "dark")
        ? { ...rows.find((r) => r.mode === "dark")!, b64: dark.base64 }
        : null,
      darkFailed: !!darkErr,
      generatedAt: new Date().toISOString(),
    };
  });


export const listSavedLogos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["logo_url", "logo_url_light", "logo_url_dark", "favicon_url", "favicon_url_mono"]);
    const settingMap = Object.fromEntries((settings ?? []).map((s) => [s.key as string, (s.value as string) ?? ""]));
    const activeLight = (settingMap.logo_url_light || settingMap.logo_url || "").trim();
    const activeDark = (settingMap.logo_url_dark || "").trim();
    const activeFavicon = (settingMap.favicon_url || "").trim();
    const activeFaviconMono = (settingMap.favicon_url_mono || "").trim();

    const { data, error } = await supabaseAdmin
      .from("brand_assets")
      .select("id, label, variant, palette, created_at, pair_id, pair_mode")
      .eq("kind", "logo")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      label: string;
      variant: LogoVariant | null;
      palette: LogoPalette | null;
      createdAt: string;
      url: string;
      pairId: string | null;
      pairMode: "light" | "dark" | null;
      isActiveLight: boolean;
      isActiveDark: boolean;
    };

    const assetVersion = Date.now().toString();
    const items: Row[] = (data ?? []).map((r) => {
      const url = `/api/public/brand-asset/${r.id}.png?v=${assetVersion}`;
      return {
        id: r.id as string,
        label: r.label as string,
        variant: (r.variant as LogoVariant) ?? null,
        palette: (r.palette as LogoPalette) ?? null,
        createdAt: r.created_at as string,
        url,
        pairId: (r.pair_id as string | null) ?? null,
        pairMode: (r.pair_mode as "light" | "dark" | null) ?? null,
        isActiveLight: !!activeLight && activeLight.includes(`/brand-asset/${r.id}.png`),
        isActiveDark: !!activeDark && activeDark.includes(`/brand-asset/${r.id}.png`),
      };
    });

    const pairsMap = new Map<string, { pairId: string; light: Row | null; dark: Row | null; createdAt: string }>();
    const orphans: Row[] = [];
    for (const r of items) {
      if (!r.pairId) { orphans.push(r); continue; }
      const p = pairsMap.get(r.pairId) ?? { pairId: r.pairId, light: null, dark: null, createdAt: r.createdAt };
      if (r.pairMode === "dark") p.dark = r; else p.light = r;
      if (r.createdAt > p.createdAt) p.createdAt = r.createdAt;
      pairsMap.set(r.pairId, p);
    }
    const pairs = Array.from(pairsMap.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      activeLightUrl: activeLight,
      activeDarkUrl: activeDark,
      activeFaviconUrl: activeFavicon,
      activeFaviconMonoUrl: activeFaviconMono,
      pairs,
      orphans,
    };
  });

export const repairLogoPair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pairId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { recolorPngToWhite, removeBackgroundAndTrim } = await import("@/lib/png-bg-remove.server");

    const { data: rows, error } = await supabaseAdmin
      .from("brand_assets")
      .select("id, pair_mode, palette, variant, mime, data_base64")
      .eq("kind", "logo")
      .eq("pair_id", data.pairId);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Logo pair not found");

    const vectorVariant = rows.find((row) => row.variant)?.variant as string | null | undefined;
    if (vectorVariant) {
      const { buildLogoSvgPair } = await import("@/lib/logo-vector.server");
      const vector = buildLogoSvgPair(vectorVariant);
      const repairedIds: string[] = [];
      for (const row of rows) {
        const side = row.pair_mode === "dark" || row.palette === "mono_white" ? vector.dark : vector.light;
        const { error: updateErr } = await supabaseAdmin
          .from("brand_assets")
          .update({ data_base64: side.base64, mime: "image/svg+xml", width: side.width, height: side.height } as never)
          .eq("id", row.id as string);
        if (updateErr) throw new Error(updateErr.message);
        repairedIds.push(row.id as string);
      }

      const version = Date.now().toString();
      const { data: settings } = await supabaseAdmin
        .from("app_settings")
        .select("key, value")
        .in("key", ["logo_url", "logo_url_light", "logo_url_dark"]);
      for (const s of settings ?? []) {
        const value = String(s.value || "");
        if (!repairedIds.some((id) => value.includes(`/brand-asset/${id}.png`))) continue;
        const base = value.split("?")[0];
        const { error: settingErr } = await supabaseAdmin
          .from("app_settings")
          .upsert({ key: s.key, value: `${base}?v=${version}` } as never);
        if (settingErr) throw new Error(settingErr.message);
      }

      return { ok: true, repairedIds, version };
    }

    const repairedIds: string[] = [];
    const lightRow = rows.find((row) => row.pair_mode === "light") ?? rows.find((row) => row.palette !== "mono_white");
    let cleanedLight: string | null = null;
    if (lightRow && String(lightRow.mime || "image/png") === "image/png") {
      cleanedLight = await removeBackgroundAndTrim(String(lightRow.data_base64), {
        tolerance: 52,
        feather: 28,
        marginPct: 0.01,
        logoMode: "light",
      });
    }

    for (const row of rows) {
      const mime = String(row.mime || "image/png");
      if (mime !== "image/png") continue;
      const logoMode = row.pair_mode === "dark" || row.palette === "mono_white" ? "dark" : "light";
      const cleaned = logoMode === "dark" && cleanedLight
        ? await recolorPngToWhite(cleanedLight)
        : row.id === lightRow?.id && cleanedLight
          ? cleanedLight
          : await removeBackgroundAndTrim(String(row.data_base64), {
              tolerance: 52,
              feather: 28,
              marginPct: 0.01,
              logoMode,
            });
      const { error: updateErr } = await supabaseAdmin
        .from("brand_assets")
        .update({ data_base64: cleaned, mime: "image/png" } as never)
        .eq("id", row.id as string);
      if (updateErr) throw new Error(updateErr.message);
      repairedIds.push(row.id as string);
    }

    const version = Date.now().toString();
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["logo_url", "logo_url_light", "logo_url_dark"]);
    for (const s of settings ?? []) {
      const value = String(s.value || "");
      if (!repairedIds.some((id) => value.includes(`/brand-asset/${id}.png`))) continue;
      const base = value.split("?")[0];
      const { error: settingErr } = await supabaseAdmin
        .from("app_settings")
        .upsert({ key: s.key, value: `${base}?v=${version}` } as never);
      if (settingErr) throw new Error(settingErr.message);
    }

    return { ok: true, repairedIds, version };
  });

export const remixLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      prompt: z.string().trim().min(2).max(800),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { data: src, error: srcErr } = await supabaseAdmin
      .from("brand_assets")
      .select("id, label, variant, palette, mime, data_base64")
      .eq("id", data.id)
      .eq("kind", "logo")
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!src) throw new Error("Source logo not found");

    const mime = (src.mime as string) || "image/png";
    const srcDataUrl = `data:${mime};base64,${src.data_base64 as string}`;

    const prompt = `Edit the attached Auto World Approvals logo to apply this change while keeping the brand identity, geometry, and crisp production-quality finish intact.

Requested change:
"""
${data.prompt}
"""

Spelling of any wordmark must remain EXACTLY: AUTO WORLD APPROVALS. Centered composition, generous margin. Output a single square PNG with a FULLY TRANSPARENT background — no solid fill, no card, no frame behind the logo, only the logo shapes themselves on alpha. Preserve whichever color treatment (light strokes vs dark strokes) the source uses.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: srcDataUrl } },
          ],
        }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit hit. Please try again in a moment.");
      if (res.status === 402) throw new Error("Workspace AI credits exhausted.");
      throw new Error(`Remix failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from gateway.");

    const newLabel = `${src.label as string} (remix)`;
    const { data: row, error: insertErr } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "logo",
        label: newLabel,
        variant: src.variant,
        palette: src.palette,
        prompt: prompt.slice(0, 4000),
        mime: "image/png",
        data_base64: b64,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    return {
      id: row.id as string,
      b64,
      url: `/api/public/brand-asset/${row.id}.png`,
      label: newLabel,
      variant: src.variant as LogoVariant | null,
      palette: src.palette as LogoPalette | null,
    };
  });

/**
 * Upload a user-supplied logo into the brand library as a pair.
 * Provide at least one of `lightB64` / `darkB64`. If both are provided, they
 * share a `pair_id`. If only one is provided, it's saved alone but still
 * tagged with its pair side so the existing "Apply pair" flow works.
 *
 * Inputs are raw base64 (no `data:` prefix). Max ~6MB per file.
 */
// SVG uploads are intentionally excluded: raster formats only.
// SVGs can embed <script> / on* handlers / <foreignObject>, and the public
// brand-asset route serves stored bytes with the DB mime type — an uploaded
// SVG would be a stored-XSS payload on a public URL. Internally-generated
// SVGs (built from our own template) are still stored as image/svg+xml and
// are trusted; only untrusted uploads are restricted here.
const ALLOWED_UPLOAD_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_UPLOAD_B64 = 6 * 1024 * 1024 * 1.4; // ~6MB binary ≈ 8.4MB base64

export const uploadLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().trim().min(1).max(120),
        lightB64: z.string().optional(),
        lightMime: z.string().optional(),
        darkB64: z.string().optional(),
        darkMime: z.string().optional(),
      })
      .refine((v) => !!v.lightB64 || !!v.darkB64, {
        message: "Provide a light-bg or dark-bg image (or both).",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const pairId = crypto.randomUUID();
    const out: { light?: { id: string; url: string }; dark?: { id: string; url: string } } = {};

    async function insertSide(side: "light" | "dark", b64: string, mime: string) {
      if (!ALLOWED_UPLOAD_MIMES.has(mime)) {
        throw new Error(`Unsupported file type: ${mime}. Use PNG, JPEG, or WEBP.`);
      }
      if (b64.length > MAX_UPLOAD_B64) {
        throw new Error("File too large. Keep each image under 6MB.");
      }
      const { data: row, error } = await supabaseAdmin
        .from("brand_assets")
        .insert({
          kind: "logo",
          label: `${data.label} — ${side} bg`,
          variant: null,
          palette: side === "dark" ? "mono_white" : "brand",
          prompt: "Uploaded by admin",
          mime,
          data_base64: b64,
          created_by: context.userId,
          pair_id: pairId,
          pair_mode: side,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const id = row!.id as string;
      return { id, url: `/api/public/brand-asset/${id}.png` };
    }

    if (data.lightB64) {
      out.light = await insertSide("light", data.lightB64, data.lightMime || "image/png");
    }
    if (data.darkB64) {
      out.dark = await insertSide("dark", data.darkB64, data.darkMime || "image/png");
    }

    return { pairId, ...out };
  });

/**
 * Public read of the currently-applied site favicon URL. Used by the root
 * route loader so SSR-rendered <link rel="icon"> reflects the live favicon
 * (so search engines / browser tabs see the brand icon on first paint, not
 * just after client hydration).
 */
export const getActiveFavicon = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "favicon_url")
    .maybeSingle();
  const url = typeof data?.value === "string" ? data.value : "";
  return { faviconUrl: url };
});

/**
 * Re-apply the currently-saved favicon across the site. Bumps the cache-busting
 * version on `app_settings.favicon_url` so SSR <link rel="icon"> + every
 * browser tab fetches the latest icon immediately (no waiting on stale caches).
 * Use when the favicon already exists but isn't showing on the live site.
 */
export const applyActiveFaviconAcrossSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["favicon_url", "favicon_url_mono"]);
    const current = Object.fromEntries((rows ?? []).map((r) => [r.key as string, typeof r.value === "string" ? r.value : ""]));
    if (!current.favicon_url) throw new Error("No favicon generated yet. Click 'Generate favicon from active logo' first.");
    const v = Date.now();
    const bump = (u: string) => `${u.split("?")[0]}?v=${v}`;
    const out: { url: string; monoUrl?: string } = { url: bump(current.favicon_url) };
    const upserts: { key: string; value: string }[] = [{ key: "favicon_url", value: out.url }];
    if (current.favicon_url_mono) {
      out.monoUrl = bump(current.favicon_url_mono);
      upserts.push({ key: "favicon_url_mono", value: out.monoUrl });
    }
    const { error: upErr } = await supabaseAdmin.from("app_settings").upsert(upserts as never);
    if (upErr) throw new Error(upErr.message);
    return out;
  });

/**
 * Extract ONLY the icon/mark from the currently-active logo (light bg),
 * save it as a square transparent PNG favicon in `brand_assets`, and write
 * its URL to `app_settings.favicon_url` so the whole site picks it up.
 */
export const generateFaviconFromActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["logo_url_light", "logo_url"]);
    const sm = Object.fromEntries((settings ?? []).map((s) => [s.key as string, String(s.value ?? "")]));
    const activeUrl = (sm.logo_url_light || sm.logo_url || "").trim();
    const match = activeUrl.match(/\/brand-asset\/([0-9a-f-]{36})\.png/i);
    if (!match) throw new Error("No active logo selected. Apply a logo pair first, then generate the favicon.");
    const sourceId = match[1];

    const { data: src, error: srcErr } = await supabaseAdmin
      .from("brand_assets")
      .select("mime, data_base64")
      .eq("id", sourceId)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!src) throw new Error("Active logo source not found in library.");

    const srcMime = (src.mime as string) || "image/png";
    const srcDataUrl = `data:${srcMime};base64,${src.data_base64 as string}`;

    const prompt = `From the attached Auto World Approvals brand logo, extract ONLY the standalone icon / symbol / mark.

Strict requirements:
- Remove ALL letters, words, and the "AUTO WORLD APPROVALS" wordmark entirely. Zero text in the output.
- Output a single SQUARE PNG with a FULLY TRANSPARENT background (alpha channel). ABSOLUTELY NO white card, no grey checkerboard, no off-white plate, no frame, no shadow, no border, no halo, no gradient backdrop. Pixels outside the icon must be alpha=0.
- Place the icon centered, filling roughly 80% of the canvas, with even margins all around.
- Keep the icon's original colors, gradients, and geometry — do not redesign it.
- If the source has no distinct icon (e.g. wordmark-only logo), produce a clean square monogram badge of the letters "AWA" in the same color treatment as the source, on a transparent background.
- Final image must read clearly even at 32×32 — bold, simple, no fine detail.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: srcDataUrl } },
          ],
        }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit hit. Please try again in a moment.");
      if (res.status === 402) throw new Error("Workspace AI credits exhausted.");
      throw new Error(`Favicon generation failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const rawB64 = json.data?.[0]?.b64_json;
    if (!rawB64) throw new Error("No favicon image returned from gateway.");

    // Strip any baked-in white/checker plate so the favicon is truly transparent,
    // then derive a light-blue monochrome variant for dark backgrounds.
    const { removeBackgroundAndTrim, recolorPngToTint } = await import("@/lib/png-bg-remove.server");
    let colorB64 = rawB64;
    try {
      colorB64 = await removeBackgroundAndTrim(rawB64, { tolerance: 40, feather: 18, marginPct: 0.06, logoMode: "light" });
    } catch (e) {
      console.warn("favicon transparency cleanup failed, keeping raw image:", e);
    }
    // Tailwind sky-200 — readable on dark browser chrome and dark site backgrounds.
    const monoB64 = await recolorPngToTint(colorB64, 186, 230, 253);

    async function saveVariant(b64: string, label: string, settingKey: string) {
      const { data: row, error: insertErr } = await supabaseAdmin
        .from("brand_assets")
        .insert({
          kind: "favicon",
          label,
          prompt: prompt.slice(0, 4000),
          mime: "image/png",
          data_base64: b64,
          created_by: context.userId,
        } as never)
        .select("id")
        .single();
      if (insertErr) throw new Error(insertErr.message);
      const id = row!.id as string;
      const url = `/api/public/brand-asset/${id}.png?v=${Date.now()}`;
      const { error: upErr } = await supabaseAdmin
        .from("app_settings")
        .upsert({ key: settingKey, value: url } as never);
      if (upErr) throw new Error(upErr.message);
      return { id, url };
    }

    const color = await saveVariant(colorB64, "Site favicon — color (transparent)", "favicon_url");
    const mono = await saveVariant(monoB64, "Site favicon — light blue (transparent, for dark backgrounds)", "favicon_url_mono");

    return { url: color.url, monoUrl: mono.url, id: color.id, monoId: mono.id };
  });

