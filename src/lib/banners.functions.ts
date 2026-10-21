import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLATFORMS = {
  facebook_cover: {
    label: "Facebook Page Cover",
    size: "1640 x 624",
    aspect: "21:9 ultra-wide",
  },
  linkedin_personal: {
    label: "LinkedIn Profile Banner",
    size: "1584 x 396",
    aspect: "4:1 ultra-wide",
  },
  linkedin_company: {
    label: "LinkedIn Company Page Banner",
    size: "1128 x 191",
    aspect: "6:1 ultra-wide",
  },
  facebook_post: {
    label: "Facebook Post / Square Ad",
    size: "1200 x 1200",
    aspect: "1:1 square",
  },
} as const;

export type BannerPlatform = keyof typeof PLATFORMS;

const BRAND_BRIEF = `Brand: Auto World Approvals — a premium Canadian auto-financing brand owned by Merk Digital LTD, based in Vancouver, BC.
Visual system:
- Primary palette: deep navy (#0F1B3D), electric blue (#2D7BFF), crisp white, soft off-white.
- Accent gradient: diagonal navy → electric-blue.
- Mood: trustworthy, modern fintech meets premium dealership. Clean, confident, professional. Absolutely NOT cheesy, NOT clip-art, NOT cluttered.
- Compositional cues allowed: subtle abstract road/light-streak motifs, generous negative space, soft directional lighting.

VEHICLE REALISM (CRITICAL when a vehicle appears in the banner):
- Vehicles must be PHOTOREALISTIC photographs — DSLR / professional automotive photography quality. NOT illustrations, NOT 3D renders, NOT cartoons, NOT stylized graphics, NOT anime, NOT painterly.
- Use REAL existing makes and models from the last ~5 model years. Body proportions, headlights, grille shape, wheel design, badge placement, and trim details must accurately match a real production model. No invented or "concept" vehicles, no morphed hybrids of two brands.
- Manufacturer badges/logos on the vehicle (grille, hood, trunk, wheel center caps) must look like the real production badge for that make.
- License plates: always blur, obscure, smudge, or motion-blur the plate so no characters are readable.
- No visible third-party dealership decals, frames, stickers, or branded windshield banners.
- Lighting and materials must read as a real photograph: accurate paint reflections, realistic chrome/glass, soft natural shadows, depth-of-field bokeh, no plastic-looking surfaces, no over-saturated cartoon colors.
- Backgrounds with vehicles should be real-world environments (showroom floor, premium driveway, urban street at golden hour, modern dealership lot) — also photographic, never illustrated.`;

// Rotate vehicle hero picks so we don't generate the same car every time.
const VEHICLE_POOL = [
  "Toyota RAV4", "Honda CR-V", "Ford F-150", "Mazda CX-5", "Hyundai Tucson",
  "Kia Sportage", "Jeep Grand Cherokee", "Subaru Outback", "Nissan Rogue",
  "BMW X5", "Audi Q5", "Mercedes-Benz GLE", "Lexus RX", "Acura MDX",
  "Volkswagen Atlas", "Chevrolet Silverado", "GMC Sierra", "Ram 1500",
  "Honda Civic", "Toyota Camry", "Mazda 3", "Tesla Model Y",
];
function pickVehicle(): string {
  return VEHICLE_POOL[Math.floor(Math.random() * VEHICLE_POOL.length)];
}
function pickNVehicles(n: number): string[] {
  const pool = [...VEHICLE_POOL];
  const out: string[] = [];
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
    build: () => `Hero composition: a real, recognizable late-model ${pickVehicle()} as a professional automotive photograph on the RIGHT, gentle shallow depth-of-field. License plate blurred. Deep navy gradient on the LEFT with subtle electric-blue light streaks. Photoreal, not illustrated. Leave the LEFT THIRD as a clean low-detail dark area for overlaying light text.` },
  { id: "navy-hero-left", textZone: "right", textColor: "light",
    build: () => `Hero composition: a real, recognizable late-model ${pickVehicle()} as a professional automotive photograph on the LEFT, gentle shallow depth-of-field. License plate blurred. Deep navy gradient on the RIGHT with subtle electric-blue light streaks. Photoreal, not illustrated. Leave the RIGHT THIRD as a clean low-detail dark area for overlaying light text.` },
  { id: "white-lineup-center", textZone: "center", textColor: "dark",
    build: () => `Clean editorial product-shot composition on a PURE WHITE seamless studio background with soft natural ground shadows. A LINEUP of 4 different real late-model vehicles (${pickNVehicles(4).join(", ")}) standing in a row across the BOTTOM HALF of the frame, slight 3/4 angle, varied colors, evenly spaced, license plates blurred. The TOP HALF and CENTER stay empty clean white space for text overlay. Premium catalog photography. No text, no logos, no decals.` },
  { id: "showroom-wide-center", textZone: "center", textColor: "light",
    build: () => `Wide cinematic showroom interior at dusk: polished concrete floor, soft overhead lighting, a single hero ${pickVehicle()} parked CENTER-LEFT in soft focus, dark moody bokeh on the right. Premium dealership atmosphere. Leave the CENTER and TOP region as a clean low-detail dark area for overlaying light text. License plate blurred.` },
  { id: "soft-gradient-right", textZone: "left", textColor: "dark",
    build: () => `Bright airy composition on a soft off-white to pale-blue gradient background. A real late-model ${pickVehicle()} placed on the RIGHT in crisp product-shot lighting with a soft natural shadow, license plate blurred. The LEFT HALF stays clean light empty space for overlaying DARK text. Editorial, premium, minimal.` },
  { id: "urban-golden-hour", textZone: "right", textColor: "light",
    build: () => `Cinematic urban Canadian street at golden hour. A real late-model ${pickVehicle()} parked on the LEFT in warm directional sunlight, soft lens flare, blurred modern architecture behind. License plate blurred. The RIGHT THIRD fades into a darker shaded area for overlaying light text.` },
  { id: "duo-lineup-navy", textZone: "center", textColor: "light",
    build: () => `Two real late-model vehicles (a ${pickNVehicles(2).join(" and a ")}) parked side by side on reflective wet asphalt at night, deep navy sky with subtle electric-blue rim lighting, license plates blurred. Both vehicles on the BOTTOM HALF, leaving TOP/CENTER as a clean dark sky area for overlaying light text. Cinematic automotive photography.` },
  { id: "white-trio-bottom", textZone: "center", textColor: "dark",
    build: () => `Minimalist catalog composition on a PURE WHITE seamless background. Three different real late-model vehicles (${pickNVehicles(3).join(", ")}) arranged across the BOTTOM, slight 3/4 front angle, soft ground shadows, varied colors, license plates blurred. Generous empty white space above for text overlay. Premium editorial product photography. Absolutely no text, decals, or logos.` },
  { id: "mountain-road-right", textZone: "left", textColor: "light",
    build: () => `Cinematic Canadian Rockies highway scene. A real late-model ${pickVehicle()} driving on the RIGHT side of the frame on a sweeping mountain road, dramatic snow-capped peaks behind, moody overcast lighting with a single beam of sun. License plate blurred. LEFT THIRD is a low-detail dark mountain shadow area for overlaying light text.` },
  { id: "aerial-dealership-lot", textZone: "center", textColor: "light",
    build: () => `Top-down aerial drone shot of a premium dealership lot at blue hour. Rows of varied real late-model vehicles (${pickNVehicles(4).join(", ")}) neatly parked, glistening wet pavement reflecting overhead lot lights. License plates blurred. The CENTER lane stays as a clean darker area for overlaying light text.` },
  { id: "pastel-studio-left", textZone: "right", textColor: "dark",
    build: () => `Bright minimalist studio composition on a soft pastel peach-to-cream gradient seamless background. A real late-model ${pickVehicle()} on the LEFT in crisp product lighting, gentle ground shadow, license plate blurred. RIGHT HALF stays clean pastel empty space for overlaying DARK text. Editorial fashion-magazine feel.` },
  { id: "neon-night-city-left", textZone: "left", textColor: "light",
    build: () => `Cyberpunk-tinged night street in a modern Canadian downtown. A real late-model ${pickVehicle()} parked on the RIGHT under neon signage glow (magenta + electric blue reflections on the paint), wet asphalt, license plate blurred. LEFT THIRD fades to deep black/navy as a clean text-safe area for overlaying light text.` },
  { id: "monochrome-trio-center", textZone: "center", textColor: "dark",
    build: () => `Editorial black-and-white catalog shot on a pale grey paper-texture background. Three real late-model vehicles (${pickNVehicles(3).join(", ")}) arranged across the BOTTOM in 3/4 angle, desaturated tones with one subtle electric-blue accent reflection, soft natural shadows, license plates blurred. Generous clean grey space ABOVE for overlaying dark text.` },
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

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["superadmin", "admin"])
    .limit(1);
  if (error) { console.error("[banners] role lookup error", JSON.stringify(error), "userId=", userId); throw new Error("Role check failed"); }
  if (!data || data.length === 0) throw new Error("Forbidden");
  return supabaseAdmin;
}

async function loadLogoInfo(supabase: { from: (t: string) => { select: (c: string) => { in: (k: string, v: string[]) => Promise<{ data: Array<{ key: string; value: unknown }> | null }> } } }) {
  const { data } = await supabase
    .from("app_settings").select("key, value").in("key", ["logo_url", "logo_url_light", "logo_url_dark"]);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const v = typeof row.value === "string" ? row.value.trim() : "";
    if (v) map.set(row.key, v);
  }
  // `logo_url_dark` slot holds the white/light mark to use ON dark backgrounds.
  const lightOnDark = map.get("logo_url_dark") || "";
  const darkOnLight = map.get("logo_url_light") || map.get("logo_url") || "";
  return { lightOnDark: lightOnDark || null, darkOnLight: darkOnLight || null };
}


async function generateCopy(apiKey: string, platform: BannerPlatform): Promise<{ headline: string; tagline: string }> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write short, punchy ad copy for Auto World Approvals — a Canadian auto-financing brand. Trustworthy, premium, modern. Never cheesy. Always perfectly spelled. Output ONLY valid JSON." },
          { role: "user", content: `Write one headline (5-8 words, benefit-driven, no emojis) and one supporting tagline (8-14 words) for a ${platform} banner. Avoid generic phrases like "drive your dreams". Return JSON: { "headline": "...", "tagline": "..." }` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`copy gen ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { headline?: string; tagline?: string };
    return {
      headline: (parsed.headline ?? "Approved. Driven. Done.").trim(),
      tagline: (parsed.tagline ?? "Premium auto financing made simple for every Canadian driver.").trim(),
    };
  } catch (e) {
    console.error("[banners] copy generation fell back", e);
    return { headline: "Approved. Driven. Done.", tagline: "Premium auto financing made simple for every Canadian driver." };
  }
}

async function generateOne(opts: {
  apiKey: string;
  spec: { label: string; size: string; aspect: string };
  platform: BannerPlatform;
  template: BannerTemplate;
  logoUrl: string | null;
  supabase: any;
  userId: string;
}) {
  const { apiKey, spec, platform, template, logoUrl, supabase, userId } = opts;
  const angle = template.build();

  const imagePrompt = `Generate a polished social media banner BACKGROUND for ${spec.label} (target output ${spec.size}, ${spec.aspect}).

${BRAND_BRIEF}

Variation direction (template: ${template.id}):
"""
${angle}
"""

CRITICAL — TEXT AND LOGO RULES (non-negotiable):
- DO NOT render ANY text, letters, numbers, words, captions, watermarks, signatures, taglines, headlines, slogans, URLs, phone numbers, or call-to-action buttons anywhere in the image.
- DO NOT render the "Auto World Approvals" wordmark, logo, brand mark, badge, monogram, or icon anywhere in the image.
- DO NOT render any third-party brand logos, dealer badges, or company marks (apart from the vehicle's own factory manufacturer badge on the car itself, which IS allowed).
- The image must be a clean photographic background ONLY. Text and the brand logo will be composited on top later as separate editable layers.
- Respect the text-safe zone described in the variation direction — keep it clean, low-detail, with no busy elements.

Output one single finished background image ready for text overlay.`;

  const userContent: Array<Record<string, unknown>> = [{ type: "text", text: imagePrompt }];

  const [imgRes, copy] = await Promise.all([
    fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    }),
    generateCopy(apiKey, platform),
  ]);

  if (!imgRes.ok) {
    const errText = await imgRes.text().catch(() => "");
    if (imgRes.status === 429) throw new Error("Rate limit hit. Please try again in a moment.");
    if (imgRes.status === 402) throw new Error("Workspace AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    throw new Error(`Image generation failed (${imgRes.status}): ${errText.slice(0, 300)}`);
  }
  const json = (await imgRes.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from gateway.");

  const metadata = {
    overlays: {
      headline: copy.headline,
      tagline: copy.tagline,
      logoUrl: logoUrl ?? null,
      textZone: template.textZone,
      textColor: template.textColor,
      templateId: template.id,
    },
  };

  const { data: row, error: insertErr } = await supabase
    .from("brand_assets")
    .insert({
      kind: "banner",
      label: spec.label,
      platform,
      prompt: imagePrompt.slice(0, 4000),
      mime: "image/png",
      data_base64: b64,
      created_by: userId,
      metadata,
    })
    .select("id")
    .single();
  if (insertErr) console.error("[banner] save to library failed", insertErr);

  return {
    id: row?.id ?? null,
    b64,
    url: row?.id ? `/api/public/brand-asset/${row.id}.png` : null,
    overlays: metadata.overlays,
  };
}

export const generateBannerVariations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        platform: z.enum(Object.keys(PLATFORMS) as [BannerPlatform, ...BannerPlatform[]]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const spec = PLATFORMS[data.platform];
    const template = pickBannerTemplate();
    const { lightOnDark, darkOnLight } = await loadLogoInfo(supabaseAdmin as any);
    const logoUrl = template.textColor === "light" ? (lightOnDark || darkOnLight) : (darkOnLight || lightOnDark);

    const banner = await generateOne({
      apiKey: key,
      spec,
      platform: data.platform,
      template,
      logoUrl,
      supabase: supabaseAdmin,
      userId: context.userId,
    });

    return {
      platform: data.platform,
      label: spec.label,
      size: spec.size,
      generatedAt: new Date().toISOString(),
      banner,
    };
  });

export const BANNER_PLATFORMS = PLATFORMS;

export const listSavedBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("brand_assets")
      .select("id, label, platform, created_at, metadata")
      .eq("kind", "banner")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      label: r.label as string,
      platform: (r.platform as BannerPlatform) ?? null,
      createdAt: r.created_at as string,
      url: `/api/public/brand-asset/${r.id}.png`,
      overlays: ((r.metadata as { overlays?: { headline?: string; tagline?: string; logoUrl?: string | null; textZone?: "left" | "right" | "center"; textColor?: "light" | "dark" } } | null)?.overlays) ?? null,
    }));
  });

export const deleteSavedBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("brand_assets")
      .delete()
      .eq("id", data.id)
      .eq("kind", "banner");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveEditedBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().trim().min(1).max(200),
        platform: z.string().trim().max(60).optional().nullable(),
        dataBase64: z.string().min(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const b64 = data.dataBase64.replace(/^data:image\/\w+;base64,/, "");
    const platform = (data.platform && (data.platform in PLATFORMS) ? data.platform : null) as BannerPlatform | null;
    const { data: row, error } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "banner",
        label: data.label,
        platform,
        prompt: "Edited in canvas editor",
        mime: "image/png",
        data_base64: b64,
        created_by: context.userId,
        metadata: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, url: `/api/public/brand-asset/${row.id}.png` };
  });

export const remixBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        prompt: z.string().trim().min(2).max(800),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { data: src, error: srcErr } = await supabaseAdmin
      .from("brand_assets")
      .select("id, label, platform, mime, data_base64, metadata")
      .eq("id", data.id)
      .eq("kind", "banner")
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!src) throw new Error("Source banner not found");

    const platform = (src.platform as BannerPlatform) ?? "facebook_cover";
    const spec = PLATFORMS[platform] ?? PLATFORMS.facebook_cover;
    const mime = (src.mime as string) || "image/png";
    const srcDataUrl = `data:${mime};base64,${src.data_base64 as string}`;
    const srcMeta = (src.metadata as { overlays?: { headline?: string; tagline?: string; logoUrl?: string | null; textZone?: "left" | "right" | "center"; textColor?: "light" | "dark" } } | null) ?? null;

    const prompt = `Edit the attached banner BACKGROUND to apply the following change while keeping the overall brand look, composition, and ${spec.aspect} aspect ratio intact.

Requested change:
"""
${data.prompt}
"""

${BRAND_BRIEF}

CRITICAL — TEXT AND LOGO RULES (non-negotiable):
- The output must remain a clean photographic BACKGROUND ONLY.
- DO NOT render ANY text, letters, numbers, captions, watermarks, taglines, headlines, slogans, URLs, or call-to-action buttons.
- DO NOT render the "Auto World Approvals" wordmark, logo, brand mark, or any third-party logos. (Factory manufacturer badges on a vehicle itself are allowed.)
- Preserve a clean, low-detail "text-safe zone" covering roughly the LEFT THIRD of the frame.

Output a single finished background for ${spec.label} (${spec.size}).`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: srcDataUrl } },
            ],
          },
        ],
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

    const { data: row, error: insertErr } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "banner",
        label: `${src.label as string} (remix)`,
        platform,
        prompt: prompt.slice(0, 4000),
        mime: "image/png",
        data_base64: b64,
        created_by: context.userId,
        metadata: srcMeta,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    return {
      id: row.id as string,
      b64,
      url: `/api/public/brand-asset/${row.id}.png`,
      label: `${src.label as string} (remix)`,
      platform,
      size: spec.size,
      overlays: srcMeta?.overlays ?? null,
    };
  });
