/**
 * Server-only handlers for the background-job system.
 *
 * Each handler takes the validated `input` jsonb from the row plus the
 * service-role `supabaseAdmin` client and a job id, runs the AI work, and
 * returns the JSON value to write into `jobs.result`. Throwing here is OK —
 * the run-job route catches and writes the error to the row.
 *
 * IMPORTANT: This file is server-only (`.server.ts`) and must never be
 * imported from anything in the client module graph.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildLogoSvgPair } from "@/lib/logo-vector.server";
import { recolorPngToWhite, removeBackgroundAndTrim } from "@/lib/png-bg-remove.server";
import { runGenerateHappyClient, runRegenerateHappyClientPhoto } from "@/lib/happy-clients-gen.server";

type Supa = typeof supabaseAdmin;

export async function handleHappyClientGenerate(
  input: { notes?: string; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  return runGenerateHappyClient(input, supabase);
}

export async function handleHappyClientRegenerate(
  input: { id: string; notes?: string; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  return runRegenerateHappyClientPhoto(input, supabase);
}

async function cleanLogoPng(b64: string, logoMode: "light" | "dark"): Promise<string> {
  try {
    return await removeBackgroundAndTrim(b64, { tolerance: 52, feather: 28, marginPct: 0.01, logoMode });
  } catch (e) {
    console.error("[logo] bg-remove failed, keeping original", e);
    return b64;
  }
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";

// ===================== LOGOS =====================

const LOGO_VARIANTS = {
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
      "ONLY the standalone brand icon/mark — no letters, no words, no wordmark. A confident, abstract, geometric symbol suggesting forward motion, approval, and the automotive world. Square app-icon ready.",
  },
  wordmark_only: {
    label: "Wordmark only (no icon)",
    direction:
      "Just the wordmark 'AUTO WORLD APPROVALS' set in a custom-feeling bold modern geometric sans-serif. Tight, confident letterspacing. No icon, no decorative elements. Single line.",
  },
  monogram: {
    label: "Monogram — 'AWA' badge",
    direction:
      "A circular or shield-style monogram badge containing the letters 'AWA' — clean, premium, custom-feeling typography. No additional words.",
  },
} as const;
type LogoVariantKey = keyof typeof LOGO_VARIANTS;

function gatewayError(status: number, text: string) {
  if (status === 429) return new Error("Rate limit hit. Try again in a moment.");
  if (status === 402) return new Error("Workspace AI credits exhausted.");
  return new Error(`Image generation failed (${status}): ${text.slice(0, 300)}`);
}

async function callImageGen(apiKey: string, model: string, content: unknown) {
  const body = model.startsWith("openai/")
    ? {
        model,
        prompt: typeof content === "string" ? content : JSON.stringify(content),
        quality: "low",
        size: "1024x1024",
        n: 1,
      }
    : {
        model,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw gatewayError(res.status, t);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from gateway.");
  return b64;
}

export async function handleLogoGenerate(
  input: { variant: LogoVariantKey; notes?: string; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  const variant = LOGO_VARIANTS[input.variant];
  const basePrompt = `Production SVG logo for Auto World Approvals. Variant: ${variant.label}. ${variant.direction}`;
  const { light, dark } = buildLogoSvgPair(input.variant);

  const pairId = crypto.randomUUID();
  const out: { pairId: string; light?: { id: string; url: string }; dark?: { id: string; url: string }; darkFailed: boolean } = { pairId, darkFailed: false };

  const { data: lightRow, error: lErr } = await supabase
    .from("brand_assets")
    .insert({
      kind: "logo",
      label: `${variant.label} — light bg`,
      variant: input.variant,
      palette: "brand",
      prompt: basePrompt.slice(0, 4000),
      mime: "image/svg+xml",
      data_base64: light.base64,
      width: light.width,
      height: light.height,
      created_by: input.userId,
      pair_id: pairId,
      pair_mode: "light",
    } as never)
    .select("id").single();
  if (lErr) throw new Error(lErr.message);
  out.light = { id: lightRow!.id as string, url: `/api/public/brand-asset/${lightRow!.id}.png` };

  const { data: darkRow } = await supabase
    .from("brand_assets")
    .insert({
      kind: "logo",
      label: `${variant.label} — dark bg`,
      variant: input.variant,
      palette: "mono_white",
      prompt: basePrompt.slice(0, 4000),
      mime: "image/svg+xml",
      data_base64: dark.base64,
      width: dark.width,
      height: dark.height,
      created_by: input.userId,
      pair_id: pairId,
      pair_mode: "dark",
    } as never)
    .select("id").single();
  if (darkRow) out.dark = { id: darkRow.id as string, url: `/api/public/brand-asset/${darkRow.id}.png` };

  return out;
}

export async function handleLogoRemix(
  input: { id: string; prompt: string; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const { data: src, error: srcErr } = await supabase
    .from("brand_assets")
    .select("id, label, variant, palette, pair_mode, mime, data_base64")
    .eq("id", input.id).eq("kind", "logo").maybeSingle();
  if (srcErr) throw new Error(srcErr.message);
  if (!src) throw new Error("Source logo not found");

  const mime = (src.mime as string) || "image/png";
  const srcDataUrl = `data:${mime};base64,${src.data_base64 as string}`;

  const prompt = `Edit the attached Auto World Approvals logo to apply this change while keeping the brand identity, geometry, and crisp production-quality finish intact.

Requested change:
"""
${input.prompt}
"""

Spelling of any wordmark must remain EXACTLY: AUTO WORLD APPROVALS. Centered composition, generous margin. Output a single square PNG with a FULLY TRANSPARENT background — no solid fill, no card, no frame. Preserve whichever color treatment (light strokes vs dark strokes) the source uses.`;

  const rawB64 = await callImageGen(apiKey, "google/gemini-3.1-flash-image-preview", [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: srcDataUrl } },
  ]);
  const b64 = await cleanLogoPng(rawB64, src.pair_mode === "dark" || src.palette === "mono_white" ? "dark" : "light");

  const newLabel = `${src.label as string} (remix)`;
  const { data: row, error: insertErr } = await supabase
    .from("brand_assets")
    .insert({
      kind: "logo",
      label: newLabel,
      variant: src.variant as never,
      palette: src.palette as never,
      prompt: prompt.slice(0, 4000),
      mime: "image/png",
      data_base64: b64,
      created_by: input.userId,
    })
    .select("id").single();
  if (insertErr) throw new Error(insertErr.message);

  return {
    id: row.id as string,
    url: `/api/public/brand-asset/${row.id}.png`,
    label: newLabel,
  };
}

// ===================== BANNERS =====================

const BANNER_PLATFORMS = {
  facebook_cover: { label: "Facebook Page Cover", size: "1640 x 624", aspect: "21:9 ultra-wide" },
  linkedin_personal: { label: "LinkedIn Profile Banner", size: "1584 x 396", aspect: "4:1 ultra-wide" },
  linkedin_company: { label: "LinkedIn Company Page Banner", size: "1128 x 191", aspect: "6:1 ultra-wide" },
  facebook_post: { label: "Facebook Post / Square Ad", size: "1200 x 1200", aspect: "1:1 square" },
} as const;
type BannerPlatformKey = keyof typeof BANNER_PLATFORMS;

const BANNER_BRIEF = `Brand: Auto World Approvals — premium Canadian auto-financing brand owned by Merk Digital LTD, Vancouver BC.
Palette: deep navy (#0F1B3D), electric blue (#2D7BFF), crisp white, soft off-white. Accent: diagonal navy → electric-blue gradient.
Mood: trustworthy modern fintech meets premium dealership. Clean, confident, not cheesy.

VEHICLE REALISM (when a vehicle appears):
- Photoreal DSLR-quality automotive photography. Never illustrated/3D/cartoon/painterly.
- Real existing makes/models from the last ~5 model years. Accurate proportions, headlights, grille, wheels, badges.
- Manufacturer badges must look like the real production badge for that make.
- License plates always blurred/obscured/out of frame — never a fake plate number.
- No third-party dealership decals or stickers.
- Real-world backgrounds (showroom, premium driveway, urban street at golden hour).`;

const BANNER_VEHICLE_POOL = [
  "Toyota RAV4", "Honda CR-V", "Ford F-150", "Mazda CX-5", "Hyundai Tucson",
  "Kia Sportage", "Jeep Grand Cherokee", "Subaru Outback", "Nissan Rogue",
  "BMW X5", "Audi Q5", "Mercedes-Benz GLE", "Lexus RX", "Acura MDX",
  "Volkswagen Atlas", "Chevrolet Silverado", "GMC Sierra", "Ram 1500",
  "Honda Civic", "Toyota Camry", "Mazda 3", "Tesla Model Y",
];
function pickVehicle(): string {
  return BANNER_VEHICLE_POOL[Math.floor(Math.random() * BANNER_VEHICLE_POOL.length)];
}
function pickN<T>(arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

type BannerTemplate = {
  id: string;
  textZone: "left" | "right" | "center";
  textColor: "light" | "dark";
  build: () => string;
};

const BANNER_TEMPLATES: BannerTemplate[] = [
  { id: "navy-hero-right", textZone: "left", textColor: "light",
    build: () => `Hero composition: a real, recognizable late-model ${pickVehicle()} shot as professional automotive photography on the RIGHT side, gentle shallow-DOF blur. License plate blurred. Deep navy gradient on the LEFT with subtle electric-blue light streaks. Photoreal, not illustrated. Leave the LEFT THIRD of the frame as a clean low-detail area suitable for overlaying text.` },
  { id: "navy-hero-left", textZone: "right", textColor: "light",
    build: () => `Hero composition: a real, recognizable late-model ${pickVehicle()} shot as professional automotive photography on the LEFT side, gentle shallow-DOF blur. License plate blurred. Deep navy gradient on the RIGHT with subtle electric-blue light streaks. Photoreal, not illustrated. Leave the RIGHT THIRD of the frame as a clean low-detail area suitable for overlaying text.` },
  { id: "white-lineup-center", textZone: "center", textColor: "dark",
    build: () => `Clean editorial product-shot composition on a PURE WHITE seamless studio background with very soft natural drop shadows under each vehicle. A LINEUP of 4 different real late-model vehicles (${pickN(BANNER_VEHICLE_POOL, 4).join(", ")}) standing in a row across the BOTTOM HALF of the frame, slight 3/4 angle, varied colors, evenly spaced, license plates blurred. The TOP HALF and CENTER of the frame is empty clean white space for text overlay. Premium catalog photography style. No text, no logos, no decals.` },
  { id: "showroom-wide-center", textZone: "center", textColor: "light",
    build: () => `Wide cinematic showroom interior at dusk: polished concrete floor, soft ambient overhead lighting, a single hero ${pickVehicle()} parked CENTER-LEFT in soft focus, dark moody bokeh on the right. Premium dealership atmosphere. Leave the CENTER and TOP region as a clean low-detail dark area suitable for overlaying light text. License plate blurred.` },
  { id: "soft-gradient-right", textZone: "left", textColor: "dark",
    build: () => `Bright airy composition on a soft off-white to pale-blue gradient background. A real late-model ${pickVehicle()} placed on the RIGHT side in crisp product-shot lighting with a soft natural shadow, license plate blurred. The LEFT HALF is clean light empty space suitable for overlaying DARK text. Editorial, premium, minimal.` },
  { id: "urban-golden-hour", textZone: "right", textColor: "light",
    build: () => `Cinematic urban street scene at golden hour in a Canadian city. A real late-model ${pickVehicle()} parked on the LEFT in warm directional sunlight, soft lens flare, blurred modern architecture behind. License plate blurred. The RIGHT THIRD fades into a darker shaded area suitable for overlaying light text.` },
  { id: "duo-lineup-navy", textZone: "center", textColor: "light",
    build: () => `Two real late-model vehicles (a ${pickN(BANNER_VEHICLE_POOL, 2).join(" and a ")}) parked side by side on a reflective wet asphalt surface at night, deep navy sky with subtle electric-blue rim lighting on the cars, license plates blurred. Both vehicles positioned on the BOTTOM HALF, leaving the TOP/CENTER as a clean dark sky area for overlaying light text. Cinematic automotive photography.` },
  { id: "white-trio-bottom", textZone: "center", textColor: "dark",
    build: () => `Minimalist clean catalog composition on a pure white seamless background. Three different real late-model vehicles (${pickN(BANNER_VEHICLE_POOL, 3).join(", ")}) arranged across the BOTTOM of the frame, slight 3/4 front angle, soft natural ground shadows, varied colors, license plates blurred. Generous empty white space above for text overlay. Premium editorial product photography. Absolutely no text, decals, or logos anywhere.` },
  { id: "mountain-road-right", textZone: "left", textColor: "light",
    build: () => `Cinematic Canadian Rockies highway scene. A real late-model ${pickVehicle()} driving on the RIGHT side of the frame on a sweeping mountain road, dramatic snow-capped peaks behind, moody overcast lighting with a single beam of sun. License plate blurred. LEFT THIRD is a low-detail dark mountain shadow area for overlaying light text.` },
  { id: "aerial-dealership-lot", textZone: "center", textColor: "light",
    build: () => `Top-down aerial drone shot of a premium dealership lot at blue hour. Rows of varied real late-model vehicles (${pickN(BANNER_VEHICLE_POOL, 4).join(", ")}) neatly parked, glistening wet pavement reflecting overhead lot lights. License plates blurred. The CENTER lane stays as a clean darker area for overlaying light text.` },
  { id: "pastel-studio-left", textZone: "right", textColor: "dark",
    build: () => `Bright minimalist studio composition on a soft pastel peach-to-cream gradient seamless background. A real late-model ${pickVehicle()} on the LEFT in crisp product lighting, gentle ground shadow, license plate blurred. RIGHT HALF stays clean pastel empty space for overlaying DARK text. Editorial fashion-magazine feel.` },
  { id: "neon-night-city-left", textZone: "left", textColor: "light",
    build: () => `Cyberpunk-tinged night street in a modern Canadian downtown. A real late-model ${pickVehicle()} parked on the RIGHT under neon signage glow (magenta + electric blue reflections on the paint), wet asphalt, license plate blurred. LEFT THIRD fades to deep black/navy as a clean text-safe area for overlaying light text.` },
  { id: "monochrome-trio-center", textZone: "center", textColor: "dark",
    build: () => `Editorial black-and-white catalog shot on a pale grey paper-texture background. Three real late-model vehicles (${pickN(BANNER_VEHICLE_POOL, 3).join(", ")}) arranged across the BOTTOM in 3/4 angle, desaturated tones with one subtle electric-blue accent reflection, soft natural shadows, license plates blurred. Generous clean grey space ABOVE for overlaying dark text.` },
  { id: "forest-suv-left", textZone: "right", textColor: "light",
    build: () => `A real late-model ${pickVehicle()} parked on a forest service road in coastal BC, towering evergreens behind, soft morning fog catching sunlight, license plate blurred. Vehicle on the LEFT HALF. RIGHT THIRD is darker forest shadow area for overlaying light text.` },
  { id: "winter-snow-truck", textZone: "left", textColor: "dark",
    build: () => `A real late-model pickup or SUV ${pickVehicle()} parked on a freshly snow-dusted alpine road, soft overcast white sky, snowy evergreens, faint breath-of-morning mist, license plate blurred. Vehicle on the RIGHT HALF. LEFT THIRD is bright snowy negative space for overlaying DARK text.` },
  { id: "split-color-block", textZone: "left", textColor: "light",
    build: () => `Bold editorial split composition: LEFT HALF is a solid flat deep-navy color block (clean empty), RIGHT HALF is a real late-model ${pickVehicle()} on a complementary electric-blue gradient with a soft floor shadow, license plate blurred. Modern minimal magazine layout. LEFT navy block is the text-safe zone for light text.` },
  { id: "side-profile-silhouette", textZone: "center", textColor: "light",
    build: () => `Cinematic backlit side profile of a real late-model ${pickVehicle()} on a wet road at sunrise, glowing rim light around the silhouette, atmospheric haze, license plate blurred. Vehicle anchored to the BOTTOM EDGE. TOP/CENTER is a clean glowing-sky area dark enough at top for overlaying light text.` },
  { id: "desert-sunset-luxury", textZone: "right", textColor: "light",
    build: () => `Premium automotive editorial in a Canadian Okanagan-style sunlit dry landscape at golden hour. A real late-model luxury ${pickVehicle()} parked on a dusty road on the LEFT, warm orange sky, long shadow, license plate blurred. RIGHT THIRD is a deeper warm shadow for overlaying light text.` },
  { id: "white-single-hero", textZone: "left", textColor: "dark",
    build: () => `Pure catalog studio shot on a PURE WHITE seamless background. A single real late-model ${pickVehicle()} centered slightly RIGHT-OF-CENTER in flawless even product lighting, soft contact shadow, license plate blurred. LEFT THIRD is empty clean white space for overlaying DARK text. Premium magazine-cover quality. Absolutely no text, decals, or logos.` },
  { id: "jobsite-pickup-top", textZone: "center", textColor: "light",
    build: () => `Working-Canadian jobsite at blue hour: a real late-model pickup ${pickVehicle()} parked confidently on the BOTTOM RIGHT, soft glow from string lights, faint silhouette of a build site behind, license plate blurred. TOP HALF is a clean darker blue sky area for overlaying light text. Cinematic, aspirational, not staged.` },
];

function pickBannerTemplate(): BannerTemplate {
  return BANNER_TEMPLATES[Math.floor(Math.random() * BANNER_TEMPLATES.length)];
}

const CLEAN_BG_RULES = `CRITICAL — TEXT AND LOGO RULES (non-negotiable):
- DO NOT render ANY text, letters, numbers, words, captions, watermarks, signatures, taglines, headlines, slogans, URLs, phone numbers, or CTA buttons anywhere in the image.
- DO NOT render the "Auto World Approvals" wordmark, logo, brand mark, badge, monogram, or icon.
- DO NOT render any third-party brand logos or dealer badges (the vehicle's own factory manufacturer badge on the car itself IS allowed).
- The image must be a clean photographic BACKGROUND only. Text and the brand logo are composited on top later as separate editable layers.
- Respect the text-safe zone described in the variation direction above — keep it clean, low detail, with no busy elements.`;

async function loadLogoPublicUrl(supabase: Supa, prefer: "light" | "dark" = "light"): Promise<string | null> {
  // `light` = white/light logo for dark backgrounds; `dark` = dark logo for light backgrounds.
  const { data } = await supabase
    .from("app_settings").select("key, value").in("key", ["logo_url_dark", "logo_url_light", "logo_url"]);
  const map = new Map<string, string>();
  for (const row of (data as Array<{ key: string; value: unknown }> | null) ?? []) {
    const v = typeof row.value === "string" ? row.value.trim() : "";
    if (v) map.set(row.key, v);
  }
  // NB: `logo_url_dark` stores the logo to use ON dark backgrounds (i.e. the white/light mark).
  if (prefer === "light") {
    return map.get("logo_url_dark") || map.get("logo_url_light") || map.get("logo_url") || null;
  }
  return map.get("logo_url_light") || map.get("logo_url") || map.get("logo_url_dark") || null;
}


async function loadLogoDataUrl(supabase: Supa): Promise<string | null> {
  const logoUrl = await loadLogoPublicUrl(supabase);
  if (!logoUrl) return null;
  try {
    const r = await fetch(logoUrl);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    const b64 = Buffer.from(buf).toString("base64");
    const mime = r.headers.get("content-type")?.split(";")[0] || "image/png";
    return `data:${mime};base64,${b64}`;
  } catch { return null; }
}

async function generateBannerCopy(apiKey: string, platform: BannerPlatformKey): Promise<{ headline: string; tagline: string }> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write short, punchy ad copy for Auto World Approvals — a Canadian auto-financing brand. Trustworthy, premium, modern. Never cheesy. Always perfectly spelled. Output ONLY valid JSON." },
          { role: "user", content: `Write one headline (5-8 words, benefit-driven, no emojis) and one supporting tagline (8-14 words) for a ${platform} banner. Avoid clichés like "drive your dreams". Return JSON: { "headline": "...", "tagline": "..." }` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`copy ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { headline?: string; tagline?: string };
    return {
      headline: (parsed.headline ?? "Approved. Driven. Done.").trim(),
      tagline: (parsed.tagline ?? "Premium auto financing made simple for every Canadian driver.").trim(),
    };
  } catch (e) {
    console.error("[banner] copy gen fell back", e);
    return { headline: "Approved. Driven. Done.", tagline: "Premium auto financing made simple for every Canadian driver." };
  }
}

export async function handleBannerVariations(
  input: { platform: BannerPlatformKey; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const spec = BANNER_PLATFORMS[input.platform];
  const template = pickBannerTemplate();

  const fullPrompt = `Generate a polished social media banner BACKGROUND for ${spec.label} (target ${spec.size}, ${spec.aspect}).

${BANNER_BRIEF}

Variation direction (template: ${template.id}):
"""
${template.build()}
"""

${CLEAN_BG_RULES}

Output one single finished background image ready for text overlay.`;

  const [b64, copy, logoUrl] = await Promise.all([
    callImageGen(apiKey, "google/gemini-3.1-flash-image-preview", [{ type: "text", text: fullPrompt }]),
    generateBannerCopy(apiKey, input.platform),
    loadLogoPublicUrl(supabase, template.textColor),
  ]);

  const metadata = {
    overlays: {
      headline: copy.headline,
      tagline: copy.tagline,
      logoUrl: logoUrl,
      textZone: template.textZone,
      textColor: template.textColor,
      templateId: template.id,
    },
  };

  const { data: row, error } = await supabase
    .from("brand_assets")
    .insert({
      kind: "banner",
      label: spec.label,
      platform: input.platform,
      prompt: fullPrompt.slice(0, 4000),
      mime: "image/png",
      data_base64: b64,
      created_by: input.userId,
      metadata,
    })
    .select("id").single();
  if (error) throw new Error(error.message);

  return {
    id: row.id as string,
    url: `/api/public/brand-asset/${row.id}.png`,
    label: spec.label,
    size: spec.size,
    platform: input.platform,
    overlays: metadata.overlays,
  };
}

export async function handleBannerRemix(
  input: { id: string; prompt: string; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const { data: src, error: srcErr } = await supabase
    .from("brand_assets")
    .select("id, label, platform, mime, data_base64, metadata")
    .eq("id", input.id).eq("kind", "banner").maybeSingle();
  if (srcErr) throw new Error(srcErr.message);
  if (!src) throw new Error("Source banner not found");

  const platform = (src.platform as BannerPlatformKey) ?? "facebook_cover";
  const spec = BANNER_PLATFORMS[platform] ?? BANNER_PLATFORMS.facebook_cover;
  const mime = (src.mime as string) || "image/png";
  const srcDataUrl = `data:${mime};base64,${src.data_base64 as string}`;
  const srcMeta = (src.metadata as { overlays?: { headline?: string; tagline?: string; logoUrl?: string | null; textZone?: "left" | "right" | "center"; textColor?: "light" | "dark" } } | null) ?? null;

  const prompt = `Edit the attached banner BACKGROUND to apply the following change while keeping the brand look, composition, and ${spec.aspect} aspect intact.

Requested change:
"""
${input.prompt}
"""

${BANNER_BRIEF}

${CLEAN_BG_RULES}

Output a single finished background for ${spec.label} (${spec.size}).`;

  const b64 = await callImageGen(apiKey, "google/gemini-3.1-flash-image-preview", [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: srcDataUrl } },
  ]);

  const newLabel = `${src.label as string} (remix)`;
  const { data: row, error: insertErr } = await supabase
    .from("brand_assets")
    .insert({
      kind: "banner",
      label: newLabel,
      platform,
      prompt: prompt.slice(0, 4000),
      mime: "image/png",
      data_base64: b64,
      created_by: input.userId,
      metadata: srcMeta,
    })
    .select("id").single();
  if (insertErr) throw new Error(insertErr.message);

  return {
    id: row.id as string,
    url: `/api/public/brand-asset/${row.id}.png`,
    label: newLabel,
    platform,
    size: spec.size,
    overlays: srcMeta?.overlays ?? null,
  };
}


// ===================== AD STUDIO =====================

const AD_BRIEF = `Brand: Auto World Approvals — premium Canadian auto-financing brand (Vancouver BC).
Palette: deep navy (#0F1B3D), electric blue (#2D7BFF), crisp white, soft off-white. Diagonal navy → electric-blue gradient accents.
Mood: trustworthy modern fintech meets premium dealership. Confident, clean, NEVER cheesy or stock-photo cliché.
Typography for overlays: bold geometric sans-serif headlines, light support lines. Perfect spelling — never invent broken letters.`;

const AD_SIZES = {
  square_1x1: { label: "Square 1:1 (IG/FB feed)", spec: "1024x1024 square, 1:1 aspect" },
  portrait_4x5: { label: "Portrait 4:5 (IG/FB feed)", spec: "vertical 4:5 aspect" },
  story_9x16: { label: "Story 9:16 (IG/FB/TikTok story)", spec: "vertical 9:16 aspect" },
  landscape_16x9: { label: "Landscape 16:9", spec: "horizontal 16:9 aspect" },
} as const;
type AdSizeKey = keyof typeof AD_SIZES;

async function loadAssetDataUrl(
  supabase: Supa,
  id: string,
  allowedKinds: string[],
): Promise<string | null> {
  const { data } = await supabase
    .from("brand_assets")
    .select("mime, data_base64, kind")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  if (!allowedKinds.includes(data.kind as string)) return null;
  const mime = (data.mime as string) || "image/png";
  return `data:${mime};base64,${data.data_base64 as string}`;
}

async function generateAdCopy(
  apiKey: string,
  sizeKey: AdSizeKey,
  userPrompt: string,
): Promise<{ headline: string; tagline: string }> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write short, punchy ad copy for Auto World Approvals — a Canadian auto-financing brand. Trustworthy, premium, modern. Never cheesy. Always perfectly spelled. Output ONLY valid JSON." },
          { role: "user", content: `Write one headline (5-8 words, benefit-driven, no emojis) and one supporting tagline (8-14 words) for a ${sizeKey} ad. ${userPrompt ? `User direction: """${userPrompt}"""` : ""} Avoid clichés like "drive your dreams". Return JSON: { "headline": "...", "tagline": "..." }` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`copy ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { headline?: string; tagline?: string };
    return {
      headline: (parsed.headline ?? "Approved. Driven. Done.").trim(),
      tagline: (parsed.tagline ?? "Premium auto financing made simple for every Canadian driver.").trim(),
    };
  } catch (e) {
    console.error("[ad] copy gen fell back", e);
    return { headline: "Approved. Driven. Done.", tagline: "Premium auto financing made simple for every Canadian driver." };
  }
}

const AD_BAKED_RULES = `CRITICAL — THIS IS A FINISHED, READY-TO-POST AD (not a wireframe, not a template):
- Output ONE single fully-finished social ad image. Every element baked into the final PNG — background, brand graphics, logo, headline, and tagline. No placeholder labels, no "HEADLINE" / "SUB-HEADLINE" / "LOGO HERE" / "YOUR TEXT" stand-ins. Lorem ipsum is forbidden.
- Use the Auto World Approvals brand palette throughout: deep navy #0F1B3D, electric blue #2D7BFF, crisp white #FFFFFF, soft off-white #F4F6FB. Diagonal navy → electric-blue gradient accents are signature.
- Match the STRUCTURAL design language of the attached reference ads — their use of bars, frames, color blocks, diagonal cuts, ribbons, badges, halftone, shading, drop shadows, layered cards, header/footer panels — but RECOLOURED into the AWA palette. Do NOT copy the references' text, their logos, their brand names, or their photo content.

CRITICAL — TYPOGRAPHY (real copy, perfectly spelled):
- Render the EXACT headline and tagline supplied below — every letter correct, no extra words, no abbreviations, no typos, no smart-quotes substituted for straight quotes.
- Use a bold geometric sans-serif for the headline (think Inter Black / Neue Haas Grotesk Display / Söhne Breit). Use a clean light sans for the tagline. Hierarchy: headline very large and dominant, tagline ~30-40% of headline height.
- Place the headline + tagline in a clean text-safe zone where they have at least 4.5:1 contrast against whatever is behind them. If the background photo is busy in that zone, drop a deep-navy color block, gradient scrim, or frosted-glass panel behind the text to guarantee legibility.
- Do NOT invent additional copy (no extra slogans, no fake phone numbers, no fake URLs, no fake prices, no CTA button text other than what's specified).

CRITICAL — LOGO (must be the attached Auto World Approvals logo, exact):
- The Auto World Approvals logo is attached as a separate input image. Composite it into the design EXACTLY as supplied — same shape, same proportions, same colors. Do NOT redraw it, do NOT add the wordmark next to it if the logo doesn't already include it, do NOT recolour it.
- Place the logo in a corner or header position that mirrors the reference style. Size it so it reads clearly without dominating the ad (~10-15% of the canvas width is typical).
- NEVER render any third-party brand logos.`;



type AdTemplate = {
  id: string;
  textZone: "left" | "right" | "center";
  textColor: "light" | "dark";
  direction: string;
};

const AD_TEMPLATES: AdTemplate[] = [
  { id: "navy-left-text", textZone: "left", textColor: "light",
    direction: "Text-safe zone is the LEFT THIRD (dark navy block / band). Photo zone is on the RIGHT." },
  { id: "white-studio-left", textZone: "right", textColor: "dark",
    direction: "Bright clean off-white background. Text-safe zone is the RIGHT HALF. Photo zone is on the LEFT." },
  { id: "dealership-handover", textZone: "left", textColor: "light",
    direction: "Dark moody background with a brand-color gradient wash. Text-safe zone is the LEFT THIRD. Photo zone is on the RIGHT." },
  { id: "urban-golden-hour-right", textZone: "left", textColor: "light",
    direction: "Warm dark gradient backdrop (amber → navy). Text-safe zone is the LEFT THIRD. Photo zone is on the RIGHT." },
  { id: "soft-pastel-portrait", textZone: "right", textColor: "dark",
    direction: "Soft peach-to-cream pastel gradient backdrop. Text-safe zone is the RIGHT HALF. Photo zone is on the LEFT." },
  { id: "split-color-block-left", textZone: "left", textColor: "light",
    direction: "Hard 50/50 split layout: LEFT HALF is a flat deep-navy color block (text-safe), RIGHT HALF is a softer brand-color gradient panel for the photo." },
  { id: "split-color-block-right", textZone: "right", textColor: "light",
    direction: "Hard 50/50 split layout: RIGHT HALF is a flat deep-navy color block (text-safe), LEFT HALF is a softer brand-color gradient panel for the photo." },
  { id: "bottom-banner-center", textZone: "center", textColor: "light",
    direction: "Photo zone occupies the upper two-thirds. BOTTOM THIRD is a dark gradient band reserved for centered light text." },
  { id: "top-banner-center-dark", textZone: "center", textColor: "dark",
    direction: "TOP HALF is a clean bright off-white band reserved for centered dark text. Photo zone is the BOTTOM HALF." },
  { id: "neon-night-left", textZone: "left", textColor: "light",
    direction: "Deep black background with magenta + electric-blue neon accent strokes / glow edges. Text-safe zone is the LEFT THIRD. Photo zone is on the RIGHT." },
  { id: "mountain-vista-right", textZone: "left", textColor: "light",
    direction: "Moody dark navy backdrop with abstract mountain-silhouette graphic elements as decoration (no real scenery). Text-safe zone is the LEFT THIRD. Photo zone is on the RIGHT." },
  { id: "coffee-shop-candid", textZone: "right", textColor: "dark",
    direction: "Warm soft cream background with subtle brand-color accents. Text-safe zone is the RIGHT THIRD. Photo zone is on the LEFT." },
  { id: "showroom-wide-center-light", textZone: "center", textColor: "light",
    direction: "Dark navy gradient backdrop with subtle electric-blue rim glow. Photo zone is in the LOWER CENTER. CENTER-TOP is a dark text-safe band for centered light text." },
  { id: "minimal-portrait-center-light", textZone: "center", textColor: "light",
    direction: "Soft dark navy radial gradient. Photo zone is centered. TOP and BOTTOM are dark text-safe bands for centered light text." },
  { id: "minimal-portrait-center-dark", textZone: "center", textColor: "dark",
    direction: "Soft off-white / pale-cream backdrop. Photo zone is centered. TOP and BOTTOM are clean bright text-safe bands for centered dark text." },
  { id: "celebratory-keys", textZone: "left", textColor: "light",
    direction: "Warm gold-to-navy diagonal gradient backdrop. Text-safe zone is the LEFT THIRD. Photo zone is on the RIGHT." },
  { id: "family-suv-warm", textZone: "right", textColor: "dark",
    direction: "Bright soft daylight gradient background. Text-safe zone is the RIGHT THIRD. Photo zone is on the LEFT." },
  { id: "highway-drive-left", textZone: "left", textColor: "light",
    direction: "Moody cloudy-sky gradient backdrop. Text-safe zone is the LEFT THIRD. Photo zone is on the RIGHT." },
  { id: "white-lifestyle-right", textZone: "right", textColor: "dark",
    direction: "Pure white seamless backdrop with a soft contact-shadow under the photo. Text-safe zone is the RIGHT THIRD. Photo zone is on the LEFT." },
  { id: "evening-citylights-bottom", textZone: "center", textColor: "light",
    direction: "Deep navy backdrop with soft abstract bokeh dots as decorative graphic. Photo zone is centered. CENTER-BOTTOM is a darker text-safe band for centered light text." },
];

function pickAdTemplate(): AdTemplate {
  return AD_TEMPLATES[Math.floor(Math.random() * AD_TEMPLATES.length)];
}

export async function handleAdGenerate(
  input: {
    label?: string;
    size: AdSizeKey;
    prompt: string;
    competitorRefIds: string[];
    clientPhotoIds: string[];
    includeLogo?: boolean;
    userId: string;
  },
  _jobId: string,
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const size = AD_SIZES[input.size] ?? AD_SIZES.square_1x1;

  // Load competitor reference images (style refs only — no caps)
  const competitorUrls: string[] = [];
  for (const id of (input.competitorRefIds ?? [])) {
    const url = await loadAssetDataUrl(supabase, id, ["ad_competitor_ref"]);
    if (url) competitorUrls.push(url);
  }

  // Load client photos as data URLs — they will be sent to the image-gen
  // model as the FULL-BLEED BACKGROUND. The prompt heavily constrains the
  // model to preserve the person and vehicle exactly.
  const clientPhotoIds = (input.clientPhotoIds ?? []).filter(Boolean);
  const clientPhotoUrls: string[] = [];
  for (const id of clientPhotoIds) {
    const url = await loadAssetDataUrl(supabase, id, ["ad_client_photo"]);
    if (url) clientPhotoUrls.push(url);
  }
  const hasClientPhoto = clientPhotoUrls.length > 0;

  const template = pickAdTemplate();
  const includeLogo = input.includeLogo !== false; // default on

  const userDirection = input.prompt?.trim() ||
    (hasClientPhoto
      ? "A premium, scroll-stopping vehicle financing ad. Editorial layout, on-brand palette."
      : "A premium, scroll-stopping vehicle financing ad featuring a clean studio/showroom vehicle as the hero. Editorial layout, on-brand palette.");

  const DIMS: Record<AdSizeKey, { w: number; h: number }> = {
    square_1x1: { w: 1024, h: 1024 },
    portrait_4x5: { w: 1024, h: 1280 },
    story_9x16: { w: 1024, h: 1820 },
    landscape_16x9: { w: 1820, h: 1024 },
  };
  const { w: W, h: H } = DIMS[input.size] ?? DIMS.square_1x1;

  // Analyze reference ads (if any) to extract their structural design spec.
  let referenceAnalysis = "";
  if (competitorUrls.length > 0) {
    try {
      const aRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: `You are a senior ad-template art director. Reverse-engineer the attached reference ads as if you were rebuilding them in Figma/Canva. Describe ONLY the design STRUCTURE — never the photographic content of any specific person, never specific brand names, never the exact words shown.

Output a concrete, replicable spec with these sections (use short bullets, be specific with proportions and approximate hex colors when visible):
  BACKGROUND / HERO IMAGERY: is the hero a person? a vehicle? a studio backdrop? full-bleed photo or contained? what fraction of the canvas?
  FRAMES & BORDERS: any outer border, inner stroke around the hero, drop-shadow, glow, or layered card stack.
  DECORATIVE GRAPHICS: stripes, diagonal bands, dots, halftone, starbursts, ribbons, corner tabs, geometric accents, brand-color sweeps, sticker callouts.
  HEADER / FOOTER BARS: any solid bar at top or bottom, height as % of canvas, color.
  COLOR BLOCKS: split-screen color panels, accent stripes, gradient overlays, scrims behind text.
  TYPOGRAPHY ZONES: where headline / body / CTA pill sits (left third / right half / bottom band / centered), and how legibility is protected (scrim, color block, outline).
  LOGO PLACEMENT: corner / header / footer, approximate size.
  OVERALL VIBE: 2-3 adjectives (e.g. "bold retail flyer", "premium fintech minimal", "loud sale-event").

Keep it tight (max ~14 bullets total). Another designer should be able to recreate this look without ever seeing the original.` },
            { role: "user", content: [
              { type: "text", text: "Extract the structural design spec from these reference ads:" },
              ...competitorUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
            ]},
          ],
          temperature: 0.3,
        }),
      });
      if (aRes.ok) {
        const aJson = (await aRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
        referenceAnalysis = aJson.choices?.[0]?.message?.content?.trim() ?? "";
      }
    } catch (e) {
      console.error("[ad] reference analysis failed", e);
    }
  }

  // Generate the real copy first so we can bake it into the image.
  const copy = await generateAdCopy(apiKey, input.size, userDirection);

  // Load the AWA logo as a data URL so we can attach it to the image model.
  const logoDataUrl = includeLogo ? await loadLogoDataUrlPrefer(supabase, template.textColor) : null;

  const hasRefs = competitorUrls.length > 0;

  const prompt = `Design ONE finished, ready-to-post Auto World Approvals social ad.

Output format: ${size.label} — ${size.spec}. Approximate canvas: ${W} x ${H} px.

${AD_BRIEF}

${hasClientPhoto
  ? `HERO IMAGE — USE THE ATTACHED CLIENT PHOTO AS THE FULL-BLEED BACKGROUND:
The first attached image is a REAL Auto World Approvals customer's photo. Use it as the FULL-BLEED background of the ad, filling the entire canvas.
- PRESERVE the customer's face, hair, expression, clothing, body, pose, AND their vehicle EXACTLY as shown. Do not restyle them, do not change their ethnicity/age/gender, do not change their car's make/model/colour/shape, do not swap the background scenery for a different scene. Treat the photo as a fixed, immutable layer that you LAYER GRAPHICS ON TOP OF — you are NOT redrawing the photo, you are designing the surrounding ad chrome.
- If the photo's aspect doesn't perfectly match the canvas, crop it tastefully (keep the person and vehicle fully visible) and extend the photo's existing background (sky / dealership lot / wall colour) at the edges so the canvas fills. Do not invent a new scene.`
  : `HERO IMAGE — CAR-ONLY AD (no client photo provided):
Generate a clean, professional vehicle hero shot suitable for an auto-financing ad — a single late-model car/SUV/truck in a clean studio or showroom setting (or a tasteful outdoor location). No people, no faces, no hands. Make the vehicle the obvious hero. Treat this as the full-bleed background you layer the brand chrome on top of.`}

${hasRefs
  ? `STYLE — MIRROR THE STRUCTURE OF THE ATTACHED REFERENCE ADS:
The attached reference ads (after the ${hasClientPhoto ? "client photo" : "first image"}${logoDataUrl ? " and AWA logo" : ""}) are the visual target for STRUCTURE only. Reproduce their design language — bars, frames, decorative graphics, badges, ribbons, color blocks, diagonal cuts, scrims, header/footer panels, typography hierarchy and zone placement — RECOLOURED into the AWA brand palette.

Reverse-engineered spec from the references (replicate this structure, recoloured to AWA):
${referenceAnalysis || "(study the attached reference images directly and mirror their structure)"}

Do NOT copy the references' text, their logos, their brand names, or their photo subjects — only their STRUCTURE.`
  : `STYLE — Use a polished editorial AWA aesthetic (premium fintech meets premium dealership). Use confident bars, color blocks, diagonal accents, soft shadows, brand-color washes. Keep it scroll-stopping but never cheesy.`}

LAYOUT VARIATION HINT (id: ${template.id}, text zone: ${template.textZone}, text color: ${template.textColor}):
${template.direction}
(If the reference ads suggest a different text zone or hierarchy, follow the REFERENCE, not this hint.)

REAL COPY — BAKE THESE EXACT WORDS INTO THE FINAL IMAGE:
- Headline (large, bold, dominant): "${copy.headline}"
- Tagline (smaller, supporting): "${copy.tagline}"
Spell every letter EXACTLY as written above. Never substitute words, abbreviate, or add extra copy.

${logoDataUrl ? `LOGO — USE THE ATTACHED AUTO WORLD APPROVALS LOGO EXACTLY:
The ${hasClientPhoto ? "second" : "first"} or last attached image (whichever is the small logo file) is the official Auto World Approvals logo. Composite it into the ad EXACTLY as supplied — same shape, same proportions, same colors. Do NOT redraw or recolour it. Place it in a corner / header position that mirrors the reference style.` : "LOGO — Skip the logo for this generation (user disabled it)."}

CREATIVE DIRECTION FROM USER (flavour only):
"""
${userDirection}
"""

${AD_BAKED_RULES}

OUTPUT: ONE single finished, ready-to-post Auto World Approvals ad — ${hasClientPhoto ? "the client photo as the full-bleed background (untouched person + vehicle)," : "the generated vehicle hero,"} the AWA brand chrome mirroring the reference style, the real AWA logo composited cleanly, and the exact headline + tagline above baked in with perfect spelling and strong legibility. No placeholder text, no wireframe labels, no extra invented copy.`;

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const url of clientPhotoUrls) content.push({ type: "image_url", image_url: { url } });
  if (logoDataUrl) content.push({ type: "image_url", image_url: { url: logoDataUrl } });
  for (const url of competitorUrls) content.push({ type: "image_url", image_url: { url } });

  const b64 = await callImageGen(apiKey, "google/gemini-3-pro-image", content);

  // Keep public client-photo URLs in metadata for record-keeping + the
  // Reuse-Template flow, but overlays are no longer composited at view time
  // (they're already baked into the saved PNG).
  const subjectUrls: string[] = [];
  for (const id of clientPhotoIds) {
    const { data: row } = await supabase
      .from("brand_assets")
      .select("id, mime, kind")
      .eq("id", id)
      .maybeSingle();
    if (!row || row.kind !== "ad_client_photo") continue;
    const ext = row.mime === "image/jpeg" ? "jpg" : row.mime === "image/webp" ? "webp" : "png";
    subjectUrls.push(`/api/public/brand-asset/${row.id}.${ext}`);
  }

  const metadata = {
    // overlays kept for backward compatibility with the canvas editor — they
    // are no longer drawn on top of the library thumbnail.
    overlays: {
      headline: copy.headline,
      tagline: copy.tagline,
      logoUrl: includeLogo ? await loadLogoPublicUrl(supabase, template.textColor) : null,
      subjectUrls,
      textZone: template.textZone,
      textColor: template.textColor,
      templateId: template.id,
    },
    // Stored so reapplyAdTemplate can replay this exact generation with a
    // different client photo (or no client photo).
    generation: {
      size: input.size,
      prompt: input.prompt ?? "",
      competitorRefIds: input.competitorRefIds ?? [],
      includeLogo,
      templateId: template.id,
    },
    baked: true,
  };

  const pairId = crypto.randomUUID();
  const labelFinal = (input.label?.trim() || `Ad — ${size.label}`).slice(0, 120);
  const { data: row, error } = await supabase
    .from("brand_assets")
    .insert({
      kind: "ad_generated",
      label: labelFinal,
      platform: input.size,
      prompt: prompt.slice(0, 4000),
      mime: "image/png",
      data_base64: b64,
      created_by: input.userId,
      pair_id: pairId,
      metadata,
    } as never)
    .select("id").single();
  if (error) throw new Error(error.message);

  return {
    id: row!.id as string,
    url: `/api/public/brand-asset/${row!.id}.png`,
    label: labelFinal,
    size: input.size,
    overlays: metadata.overlays,
  };
}

// Variant of loadLogoDataUrl that respects the dark/light preference.
async function loadLogoDataUrlPrefer(supabase: Supa, prefer: "light" | "dark" = "light"): Promise<string | null> {
  const logoUrl = await loadLogoPublicUrl(supabase, prefer);
  if (!logoUrl) return null;
  try {
    const r = await fetch(logoUrl);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    const b64 = Buffer.from(buf).toString("base64");
    const mime = r.headers.get("content-type")?.split(";")[0] || "image/png";
    return `data:${mime};base64,${b64}`;
  } catch { return null; }
}

export async function handleAdRemix(
  input: { id: string; prompt: string; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const { data: src, error: srcErr } = await supabase
    .from("brand_assets")
    .select("id, label, platform, mime, data_base64, pair_id, metadata")
    .eq("id", input.id)
    .eq("kind", "ad_generated")
    .maybeSingle();
  if (srcErr) throw new Error(srcErr.message);
  if (!src) throw new Error("Source ad not found");

  const size = AD_SIZES[(src.platform as AdSizeKey) ?? "square_1x1"] ?? AD_SIZES.square_1x1;
  const mime = (src.mime as string) || "image/png";
  const srcDataUrl = `data:${mime};base64,${src.data_base64 as string}`;
  const srcMeta = (src.metadata as { overlays?: { headline?: string; tagline?: string; logoUrl?: string | null; textZone?: "left" | "right" | "center"; textColor?: "light" | "dark"; templateId?: string }; generation?: Record<string, unknown> } | null) ?? null;

  const prompt = `Edit the attached finished Auto World Approvals ad to apply this change, while keeping the same ad format (${size.label} — ${size.spec}), the same hero subject (the person and their vehicle, if present), the AWA brand chrome, the AWA logo, and the headline/tagline copy intact unless the requested change explicitly asks to change them.

Requested change:
"""
${input.prompt}
"""

${AD_BRIEF}

${AD_BAKED_RULES}

RULES:
- Do NOT change the customer's face, body, clothing, pose, or their vehicle (make/model/colour/shape). Preserve them exactly.
- Do NOT introduce placeholder text ("HEADLINE", "SUB-HEADLINE", "LOGO HERE", lorem ipsum) — keep the real existing copy unless the requested change explicitly rewrites it.
- Adjust frames, borders, color blocks, decorative shapes, header/footer bars, shading, and text styling per the requested change.
- Output ONE single finished, ready-to-post ad with everything baked in.`;

  const b64 = await callImageGen(apiKey, "google/gemini-3-pro-image", [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: srcDataUrl } },
  ]);

  const newLabel = `${src.label as string} (remix)`;
  const { data: row, error: insertErr } = await supabase
    .from("brand_assets")
    .insert({
      kind: "ad_generated",
      label: newLabel,
      platform: src.platform as never,
      prompt: prompt.slice(0, 4000),
      mime: "image/png",
      data_base64: b64,
      created_by: input.userId,
      pair_id: (src.pair_id as string) ?? null,
      metadata: srcMeta,
    } as never)
    .select("id").single();
  if (insertErr) throw new Error(insertErr.message);

  return {
    id: row!.id as string,
    url: `/api/public/brand-asset/${row!.id}.png`,
    label: newLabel,
    size: src.platform as string,
    overlays: srcMeta?.overlays ?? null,
  };
}




// ===================== BLOG =====================

export async function handleBlogGenerate(
  input: { topic?: string; direction?: string; publish?: boolean; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  const { runBlogGenerate } = await import("@/lib/blog-gen.server");
  return runBlogGenerate(input, supabase);
}

export async function handleBlogRewrite(
  input: { id: string; direction?: string; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  const { runBlogRewrite } = await import("@/lib/blog-gen.server");
  return runBlogRewrite(input, supabase);
}

export async function handleBlogImage(
  input: { id: string; direction?: string; userId: string },
  _jobId: string,
  supabase: Supa,
) {
  const { runBlogImage } = await import("@/lib/blog-gen.server");
  return runBlogImage(input, supabase);
}
