import { createServerFn } from "@tanstack/react-start";
import { PersonNameSchema } from "@/lib/name-validation";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type HappyClient = {
  id: string;
  client_name: string;
  location: string | null;
  vehicle: string | null;
  quote: string;
  photo_url: string;
  accent_color: string | null;
  display_order: number;
  is_active: boolean;
};

export type HappyClientPhoto = {
  id: string;
  url: string;
  label: string;
  mime: string;
  created_at: string;
  in_use: boolean;
};

// List every photo ever generated / uploaded for happy clients — the library.
export const listHappyClientPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: assets, error } = await supabaseAdmin
      .from("brand_assets")
      .select("id, label, mime, created_at")
      .eq("kind", "happy_client")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const { data: clients } = await supabaseAdmin
      .from("happy_clients")
      .select("photo_url");
    const used = new Set((clients ?? []).map((c) => c.photo_url as string));
    return (assets ?? []).map((a) => {
      const ext = a.mime === "image/jpeg" ? "jpg" : a.mime === "image/webp" ? "webp" : "png";
      const url = `/api/public/brand-asset/${a.id}.${ext}`;
      return {
        id: a.id as string,
        url,
        label: (a.label as string) ?? "",
        mime: (a.mime as string) ?? "image/png",
        created_at: a.created_at as string,
        in_use: used.has(url),
      } satisfies HappyClientPhoto;
    });
  });

export const deleteHappyClientPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; force?: boolean }) => {
    if (!i.id) throw new Error("Missing id");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: asset } = await supabaseAdmin
      .from("brand_assets")
      .select("id, mime")
      .eq("id", data.id)
      .eq("kind", "happy_client")
      .maybeSingle();
    if (!asset) throw new Error("Photo not found");
    const ext = asset.mime === "image/jpeg" ? "jpg" : asset.mime === "image/webp" ? "webp" : "png";
    const url = `/api/public/brand-asset/${asset.id}.${ext}`;
    const { data: refs } = await supabaseAdmin
      .from("happy_clients")
      .select("id")
      .eq("photo_url", url);
    if ((refs?.length ?? 0) > 0 && !data.force) {
      throw new Error(`In use by ${refs!.length} happy-client entr${refs!.length === 1 ? "y" : "ies"}. Delete those first or confirm forced delete.`);
    }
    const { error } = await supabaseAdmin.from("brand_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public read — uses publishable key, RLS allows anon read of active rows.
export const listActiveHappyClients = createServerFn({ method: "GET" }).handler(async () => {
  const supabasePublic = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabasePublic
    .from("happy_clients")
    .select("id, client_name, location, vehicle, quote, photo_url, accent_color, display_order, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as HappyClient[];
});

// Admin: list everything (incl. hidden)
export const listAllHappyClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("happy_clients")
      .select("id, client_name, location, vehicle, quote, photo_url, accent_color, display_order, is_active")
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as HappyClient[];
  });

export type UpsertInput = {
  id?: string;
  client_name: string;
  location?: string | null;
  vehicle?: string | null;
  quote: string;
  photo_url: string;
  accent_color?: string | null;
  display_order?: number;
  is_active?: boolean;
};

export const upsertHappyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: UpsertInput) => {
    PersonNameSchema.parse(i.client_name);
    if (!i.quote?.trim()) throw new Error("Quote is required");
    if (!i.photo_url?.trim()) throw new Error("Photo URL is required");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const row = {
      client_name: data.client_name.trim(),
      location: data.location?.trim() || null,
      vehicle: data.vehicle?.trim() || null,
      quote: data.quote.trim(),
      photo_url: data.photo_url.trim(),
      accent_color: data.accent_color?.trim() || null,
      display_order: data.display_order ?? 0,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("happy_clients").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("happy_clients")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted!.id };
  });

export const deleteHappyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("happy_clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Upload a photo as a brand_asset (kind='happy_client') and return the public URL via /api/public/brand-asset/<id>.<ext>
export const uploadHappyClientPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { label: string; mime: string; data_base64: string }) => {
    if (!i.data_base64) throw new Error("Missing image data");
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(i.mime)) throw new Error("Unsupported image type");
    // ~4MB base64 cap
    if (i.data_base64.length > 6_000_000) throw new Error("Image too large (max ~4MB)");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "happy_client" as never,
        label: data.label?.slice(0, 100) || "Happy client photo",
        mime: data.mime,
        data_base64: data.data_base64,
        created_by: context.userId,
      })
      .select("id, mime")
      .single();
    if (error) throw new Error(error.message);
    const ext = row!.mime === "image/jpeg" ? "jpg" : row!.mime === "image/webp" ? "webp" : "png";
    return { url: `/api/public/brand-asset/${row!.id}.${ext}` };
  });

// AI-regenerate a candid, cell-phone-style photo of a client next to their vehicle.
export const regenerateHappyClientPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; notes?: string }) => {
    if (!i.id) throw new Error("Missing id");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);

    const { data: client, error: cErr } = await supabaseAdmin
      .from("happy_clients")
      .select("id, client_name, location, vehicle")
      .eq("id", data.id)
      .single();
    if (cErr || !client) throw new Error("Client not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

    // Vary subject + setting + vehicle + framing so regenerations look like
    // real, different people taking real photos — not the same template twice.
    const subjects = [
      "a 32-year-old man with a short beard, wearing a navy hoodie, jeans, and white sneakers",
      "a 27-year-old woman with shoulder-length brown hair, in a black puffer jacket and beanie",
      "a 45-year-old man in a red plaid flannel and a worn ball cap, slight belly, friendly",
      "a 24-year-old woman in a denim jacket and white tee, dangling car keys in one hand",
      "a young mixed-race couple in their late 20s, casual fall jackets, leaning into each other",
      "a South Asian dad in his mid-30s holding his 3-year-old daughter on his hip",
      "a tradesman in his 40s in Carhartt work jacket, dusty work boots, after a shift",
      "a Black woman in her 30s in athleisure with a Stanley tumbler, hair tied back",
      "a 60-year-old man with grey hair and glasses in a fleece vest, thumbs up half-jokingly",
      "a Filipino woman in her late 20s in scrubs, just off a nursing shift, tired but smiling",
      "two best friends, both early 20s guys, one in a Raptors hoodie, fist-bumping in front of the car",
      "a single mom in her early 30s with her 8-year-old son standing proudly by the bumper",
    ];
    const settings = [
      "in a snowy dealership parking lot at midday, cold blue light, breath faintly visible, generic unbranded car lot in background",
      "in front of a low generic dealership building at golden hour, long warm shadows, no signage visible",
      "in a residential driveway in the suburbs, beige house and a basketball hoop in the background",
      "at a generic unbranded gas station at dusk, faint neon glow reflecting on wet paint, pumps blurred",
      "in a large unmarked parking lot with mountains hazy in the far background",
      "on a rainy side street, damp asphalt, soft overcast grey light, leaves on the ground",
      "on a quiet small-town main street, blurred unbranded storefronts behind",
      "in a generic drive-thru lane with blank signage blurred in the background",
      "in a backyard with a wood fence and string lights, late afternoon",
      "in the driveway of a townhouse complex, recycling bins faintly visible",
      "in a dealership lot with rows of other vehicles behind, no logos or signage visible",
    ];
    const framings = [
      "shot from slightly low, full body and most of the car in frame, ~28mm phone lens",
      "tight three-quarter shot, head to mid-thigh, leaning on the front fender",
      "medium-wide, person and car centered, slightly off-axis",
      "from the side, person standing by the driver door, holding keys up casually",
      "shot at eye level from across the hood, the person mid-laugh",
    ];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const setting = settings[Math.floor(Math.random() * settings.length)];
    const framing = framings[Math.floor(Math.random() * framings.length)];
    const vehicleStr =
      client.vehicle?.trim() ||
      "their real late-model used vehicle (pick one: a silver Toyota RAV4, a black Ford F-150, a white Honda Civic, a charcoal Hyundai Tucson, or a blue Mazda CX-5)";

    const prompt = [
      `Hyper-realistic CANDID iPhone snapshot of a real car-buyer standing next to the vehicle they just bought. NOT a professional photo. NOT a stock photo. NOT a studio headshot.`,
      `Subject: ${subject}. Genuine relaxed expression — natural smile, half-laugh, or quietly proud look. Eyes mostly on camera, sometimes glancing slightly off. Realistic skin texture with pores, slight imperfections, no beauty retouching, no airbrushing. Normal everyday clothing is fine — branded apparel (logos on hats, hoodies, t-shirts) is allowed and looks natural. Natural personal items like a purse, backpack, sunglasses, or phone in hand are fine.`,
      `Vehicle: ${vehicleStr}. MUST be a real, specific, recognizable production model with accurate manufacturer badges, grille, headlights, body lines, and wheels — do NOT generate a generic/fake car. Prefer compositions where the person's body naturally blocks the model badge / trim badge on the fender or tailgate (the manufacturer logo on the grille can stay visible). Photorealistic, correct proportions, plausible reflections, license plate blurred or partially out of frame.`,
      `Scene: ${setting}. ABSOLUTELY NO surrounding business branding — no store names, no restaurant names, no gas-station brands, no dealership names, no readable storefront signage, no banners, no flags, no logos on buildings or walls. Background buildings and dealerships must be completely generic with NO readable text. (Branding on the vehicle itself and on the person's clothing is fine — only environment/store branding is forbidden.)`,
      `Framing & camera: ${framing}. Looks like an iPhone 14/15 photo a friend took — natural phone depth of field (mostly in focus, no fake bokeh), authentic dynamic range, mild sensor noise in shadows, occasional slight off-center crop. Natural ambient light only — no rim light, no softbox, no studio lighting, no HDR halos.`,
      `Composition realism: slightly imperfect framing is GOOD — a sliver of sky, the edge of another parked car, a wrinkled jacket. The subject is NOT holding takeout, coffee cups, tumblers, water bottles, or shopping bags. Keys, a purse, a phone, or sunglasses are fine.`,
      `Strictly forbid: surrounding store/restaurant/dealership signage or logos, readable storefront text, glossy commercial advertising look, magazine cover lighting, perfect symmetry, model-agency posing, white seamless background, fashion editorial, AI-generated waxy skin, text overlays, watermarks, captions, generic/fake cars without real badges, coffee cups, takeout cups, water bottles, shopping bags.`,
      data.notes?.trim() ? `Extra notes from admin: ${data.notes.trim()}` : "",
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI rate limit hit — try again in a moment.");
      if (res.status === 402) throw new Error("Workspace AI credits exhausted.");
      throw new Error(`Photo generation failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from gateway.");

    const { data: asset, error: aErr } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "happy_client" as never,
        label: `AI photo — ${client.client_name}`,
        mime: "image/png",
        data_base64: b64,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);
    const url = `/api/public/brand-asset/${asset!.id}.png`;

    const { error: uErr } = await supabaseAdmin
      .from("happy_clients")
      .update({ photo_url: url })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, photo_url: url };
  });

// AI-generate a brand-new happy client entry (photo + name + vehicle + quote)
// Uses the same template variety system as the ad studio for diverse scenes.
export const generateHappyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { notes?: string }) => i ?? {})
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

    // Template pool — mirrors ad studio variety so scenes feel different each time.
    const templates = [
      { id: "dealership-handover", scene: "in front of a generic dealership facade at golden hour, warm late-day light, NO signage or logos visible" },
      { id: "white-studio-driveway", scene: "in a clean residential driveway with a white garage door behind, soft midday overcast light" },
      { id: "snowy-lot-winter", scene: "in a snowy dealership parking lot at midday, cold blue light, faint breath visible, unbranded surroundings" },
      { id: "urban-golden-hour", scene: "on a quiet downtown street at golden hour, long warm shadows on asphalt, generic unbranded storefronts blurred behind" },
      { id: "mountain-vista", scene: "at a roadside pull-off with hazy mountains in the background, late afternoon" },
      { id: "split-color-block", scene: "in front of a bold color-blocked wall (teal and white), even daylight, no text or signage" },
      { id: "neon-night-city", scene: "at night on a wet city street, faint ambient light reflecting on the paint, no readable signage" },
      { id: "forest-suv", scene: "at a forested trailhead, pine trees behind the vehicle, soft diffused daylight" },
      { id: "desert-sunset", scene: "in an open lot at sunset, warm orange sky, dust hanging in the air" },
      { id: "jobsite-pickup", scene: "at a construction jobsite, gravel underfoot, plain hi-vis vest (no company name) nearby" },
      { id: "family-suv-driveway", scene: "in a suburban cul-de-sac driveway, kids' chalk drawings faintly on the pavement" },
      { id: "highway-rest", scene: "at a highway rest stop, generic unmarked semi-trucks blurred in the distance" },
      { id: "white-forecourt", scene: "in a bright white-pebbled showroom forecourt, even soft light, no signage" },
      { id: "evening-overpass", scene: "on an overpass at dusk, blurred city lights behind, mild ambient glow" },
      { id: "rainy-side-street", scene: "on a rainy side street, damp asphalt, soft overcast grey light, fallen leaves" },
      { id: "small-town-main", scene: "on a quiet small-town main street, blurred generic storefronts behind, no readable signs" },
      { id: "gas-station-dusk", scene: "at a generic unbranded gas station at dusk, faint glow reflecting on wet paint, pumps blurred" },
      { id: "backyard-string-lights", scene: "in a backyard with a wood fence and string lights, late afternoon" },
      { id: "dealership-lot-rows", scene: "in a dealership lot with rows of other vehicles behind, NO logos, NO banners, NO signage of any kind" },
      { id: "open-parking-lot", scene: "in a large empty unmarked parking lot at midday, clean even light" },
    ];

    const subjects = [
      { name: "Jordan M.", desc: "a 32-year-old man with a short beard, plain navy hoodie, jeans, white sneakers" },
      { name: "Priya S.", desc: "a 27-year-old South Asian woman in a plain denim jacket and white tee, holding car keys" },
      { name: "Marcus T.", desc: "a Black man in his 30s in a plain fitted bomber jacket, blank baseball cap turned forward" },
      { name: "Emily R.", desc: "a 29-year-old woman with shoulder-length brown hair, plain black puffer jacket and beanie" },
      { name: "Dave K.", desc: "a 45-year-old man in a red plaid flannel and plain worn ball cap, friendly grin" },
      { name: "The Nguyen family", desc: "a young couple in their early 30s with a toddler on dad's hip" },
      { name: "Sarah L.", desc: "a Filipino woman in her late 20s in plain solid-color nursing scrubs, tired but smiling, hair tied back" },
      { name: "Mike & Tasha", desc: "a mixed-race couple in their late 20s, plain casual fall jackets, leaning into each other" },
      { name: "Chris H.", desc: "a tradesman in his 40s in a plain canvas work jacket and dusty work boots, after a shift" },
      { name: "Aisha O.", desc: "a Black woman in her 30s in plain athleisure" },
      { name: "Bob & Linda", desc: "a retired couple in their early 60s, plain fleece vests, grey hair, warm smiles" },
      { name: "Tyler J.", desc: "a 22-year-old guy in a plain solid-color hoodie and joggers, first car energy" },
      { name: "Megan W.", desc: "a single mom in her early 30s with her 8-year-old son standing proudly by the bumper" },
      { name: "Raj P.", desc: "a 38-year-old man in a plain quarter-zip and slacks, professional but relaxed" },
      { name: "Hannah B.", desc: "a 24-year-old woman with freckles and curly red hair, plain oversized sweater" },
      { name: "Luis F.", desc: "a Latino man in his late 30s in a plain flannel shirt, holding a toddler's hand" },
      { name: "Grace Y.", desc: "an East Asian woman in her late 20s in a plain long wool coat, holding keys aloft" },
      { name: "Devon C.", desc: "a young Black man in his early 20s, plain denim jacket, fresh haircut, big grin" },
      { name: "Brittany & Sam", desc: "two best friends, both early 20s women, matching plain cropped jackets, fist-bumping" },
      { name: "Frank G.", desc: "a 55-year-old man in a plain leather jacket, thumbs-up to camera" },
    ];

    const vehicles = [
      "a silver 2022 Toyota RAV4",
      "a black 2021 Ford F-150",
      "a white 2023 Honda Civic",
      "a charcoal 2022 Hyundai Tucson",
      "a blue 2021 Mazda CX-5",
      "a red 2020 Jeep Grand Cherokee",
      "a grey 2023 Kia Sportage",
      "a white 2022 Ram 1500",
      "a navy 2021 Subaru Outback",
      "a black 2023 Nissan Rogue",
      "a silver 2022 Chevrolet Equinox",
      "a white 2021 Volkswagen Tiguan",
      "a deep green 2023 Ford Bronco Sport",
      "a black 2022 Dodge Charger",
      "a champagne 2021 Lexus RX 350",
    ];

    const framings = [
      "shot from slightly low, full body and most of the car in frame, ~28mm phone lens",
      "tight three-quarter shot, head to mid-thigh, leaning on the front fender",
      "medium-wide, person and car centered, slightly off-axis",
      "from the side, person standing by the driver door, holding keys up casually",
      "shot at eye level from across the hood, mid-laugh",
      "wide framing with the whole vehicle visible, person standing by the front quarter panel",
    ];

    const quotes = [
      "Whole thing took an afternoon. Drove home in it the same day.",
      "I was sure I'd get turned down again. They actually listened.",
      "Honestly didn't think I'd qualify. They made it happen.",
      "First car of my own. Still can't believe it.",
      "Smoothest dealership experience I've had — no pressure, no games.",
      "They got my payment lower than I expected. 10/10.",
      "Upgraded from a 2010 beater. Feels brand new to me.",
      "Approved when two other places said no. Wild.",
      "Easy from start to finish. Will send my brother here.",
      "They worked with my credit, not against it.",
      "Out the door in under two hours. Stoked.",
      "Finally something reliable for the family.",
    ];

    const locations = ["Surrey, BC", "Burnaby, BC", "Langley, BC", "Abbotsford, BC", "Coquitlam, BC", "Richmond, BC", "Maple Ridge, BC", "Chilliwack, BC", "New Westminster, BC", "Mission, BC"];

    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const template = pick(templates);
    const subject = pick(subjects);
    const vehicle = pick(vehicles);
    const framing = pick(framings);
    const quote = pick(quotes);
    const location = pick(locations);

    const prompt = [
      `Hyper-realistic CANDID iPhone snapshot of a real car-buyer standing next to the vehicle they just purchased. NOT a professional photo. NOT a stock photo. NOT a studio headshot.`,
      `Subject: ${subject.desc}. Posing for a quick photo with their new ride — relaxed, mildly proud, natural expression (small smile, half-laugh, or quiet grin). Realistic skin texture, pores, slight imperfections, no airbrushing. Normal everyday clothing is fine — branded apparel (logos on hats, hoodies, t-shirts) is allowed and looks natural. Natural personal items like a purse, backpack, sunglasses, or phone in hand are fine.`,
      `Vehicle: ${vehicle}. MUST be rendered as a real, specific, recognizable production model with accurate manufacturer badges, grille, headlights, body lines, and wheels — do NOT generate a generic/fake car. Prefer compositions where the person's body naturally blocks the model badge / trim badge on the fender or tailgate (the manufacturer logo on the grille can stay visible). Photorealistic, correct proportions, plausible reflections, license plate blurred or partially out of frame.`,
      `Scene (template "${template.id}"): ${template.scene}. ABSOLUTELY NO surrounding business branding — no store names, no restaurant names, no gas-station brands, no dealership names, no readable storefront signage, no banners, no flags, no logos on buildings or walls. Background buildings and dealerships must be completely generic with NO readable text. (Branding on the vehicle itself and on the person's clothing is fine — only environment/store branding is forbidden.)`,
      `Framing & camera: ${framing}. Looks like an iPhone 14/15 photo a friend took — natural phone depth of field, mild sensor noise in shadows, slightly imperfect crop. Natural ambient light only — no studio lighting, no rim light, no softbox, no HDR halos.`,
      `Composition realism: slight imperfection is GOOD — a sliver of sky, the edge of another parked car, a wrinkled jacket. The subject is NOT holding takeout, coffee cups, tumblers, water bottles, or shopping bags. Keys, a purse, a phone, or sunglasses are fine.`,
      `Strictly forbid: surrounding store/restaurant/dealership signage or logos, readable storefront text, glossy commercial advertising look, magazine cover lighting, perfect symmetry, model-agency posing, white seamless studio background, fashion editorial, AI-generated waxy skin, text overlays, watermarks, captions, generic/fake cars without real badges, coffee cups, takeout cups, water bottles, shopping bags.`,
      data.notes?.trim() ? `Extra notes from admin: ${data.notes.trim()}` : "",
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI rate limit hit — try again in a moment.");
      if (res.status === 402) throw new Error("Workspace AI credits exhausted.");
      throw new Error(`Photo generation failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from gateway.");

    const { data: asset, error: aErr } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "happy_client" as never,
        label: `AI photo — ${subject.name}`,
        mime: "image/png",
        data_base64: b64,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);
    const photo_url = `/api/public/brand-asset/${asset!.id}.png`;

    // Friendly vehicle label (strip leading article + year for the display string)
    const vehicleLabel = vehicle.replace(/^a\s+/i, "").replace(/^(an?\s+)?/i, "");

    const { data: maxRow } = await supabaseAdmin
      .from("happy_clients")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = ((maxRow?.display_order as number | undefined) ?? 0) + 10;

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("happy_clients")
      .insert({
        client_name: subject.name,
        location,
        vehicle: vehicleLabel,
        quote,
        photo_url,
        display_order: nextOrder,
        is_active: true,
        created_by: context.userId,
      })
      .select("id, client_name, location, vehicle, quote, photo_url, accent_color, display_order, is_active")
      .single();
    if (iErr) throw new Error(iErr.message);

    return { ok: true, client: inserted as HappyClient };
  });

// AI-regenerate the customer's name, location, vehicle, and quote so they
// match what's actually visible in the existing photo. Does NOT touch the photo.
export const regenerateHappyClientDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => {
    if (!i.id) throw new Error("Missing id");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    const supabaseAdmin = await requireAdmin(context.userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

    const { data: client, error: cErr } = await supabaseAdmin
      .from("happy_clients")
      .select("id, photo_url")
      .eq("id", data.id)
      .single();
    if (cErr || !client) throw new Error("Client not found");

    // Resolve the photo to a base64 data URL we can send to Gemini.
    let dataUrl = "";
    const photoUrl = (client.photo_url as string) || "";
    const assetMatch = photoUrl.match(/\/api\/public\/brand-asset\/([0-9a-f-]{36})/i);
    if (assetMatch) {
      const { data: asset } = await supabaseAdmin
        .from("brand_assets")
        .select("mime, data_base64")
        .eq("id", assetMatch[1])
        .maybeSingle();
      if (!asset) throw new Error("Photo asset not found");
      dataUrl = `data:${asset.mime || "image/png"};base64,${asset.data_base64}`;
    } else {
      const absUrl = photoUrl.startsWith("http")
        ? photoUrl
        : `https://wheel-financing-hub.lovable.app${photoUrl.startsWith("/") ? photoUrl : `/${photoUrl}`}`;
      const r = await fetch(absUrl);
      if (!r.ok) throw new Error(`Could not load photo (${r.status})`);
      const buf = new Uint8Array(await r.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
      }
      const b64 = btoa(binary);
      const mime = r.headers.get("content-type") || "image/png";
      dataUrl = `data:${mime};base64,${b64}`;
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write believable car-dealership happy-client cards based on a customer photo. Look carefully at the person and the vehicle. Return ONLY a JSON object with keys: client_name (e.g. 'Jordan M.' — first name + last initial, fits the apparent person), location (a Lower Mainland BC city like 'Surrey, BC', 'Burnaby, BC', 'Langley, BC', 'Abbotsford, BC', 'Coquitlam, BC', 'Richmond, BC', 'Maple Ridge, BC', 'Chilliwack, BC'), vehicle (the actual year/color/make/model you see, e.g. '2022 Silver Toyota RAV4' — be specific and accurate), quote (1–2 sentence first-person testimonial, max ~22 words, casual like a text to a friend, no emojis, no hashtags, no quotation marks, no dealership name, references the vehicle naturally). Return JSON only, no prose, no markdown fences.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Write the card for this customer photo." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.9,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI rate limit hit — try again in a moment.");
      if (res.status === 402) throw new Error("Workspace AI credits exhausted.");
      throw new Error(`AI failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: { client_name?: string; location?: string; vehicle?: string; quote?: string };
    try { parsed = JSON.parse(cleaned); } catch { throw new Error("AI did not return valid JSON"); }

    const update: { client_name?: string; location?: string; vehicle?: string; quote?: string } = {};
    if (parsed.client_name?.trim()) update.client_name = parsed.client_name.trim().slice(0, 80);
    if (parsed.location?.trim()) update.location = parsed.location.trim().slice(0, 80);
    if (parsed.vehicle?.trim()) update.vehicle = parsed.vehicle.trim().slice(0, 120);
    if (parsed.quote?.trim()) {
      update.quote = parsed.quote.trim().replace(/^["']|["']$/g, "").slice(0, 280);
    }
    if (Object.keys(update).length === 0) throw new Error("AI returned no usable fields");

    const { error: uErr } = await supabaseAdmin
      .from("happy_clients")
      .update(update)
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, ...update };
  });
