/**
 * Server-only AI image generation for Happy Clients.
 * Used by background-job handlers so generations survive navigation
 * and run concurrently with other actions.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Supa = typeof supabaseAdmin;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function genImage(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
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
  return b64;
}

async function genTestimonial(
  apiKey: string,
  opts: { name: string; vehicle: string; scene?: string; subject?: string },
  fallback: string,
): Promise<string> {
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write short, casual, believable car-dealership testimonials from real customers. 1–2 sentences, max ~22 words. First person. No emojis, no hashtags, no quotation marks, no dealership name. Reference the specific vehicle (model is fine, year/color optional) naturally — not like an ad. Sound like a real text message someone would send a friend.",
          },
          {
            role: "user",
            content: `Customer: ${opts.name}. Vehicle they just bought: ${opts.vehicle}.${opts.subject ? ` Person: ${opts.subject}.` : ""}${opts.scene ? ` Setting: ${opts.scene}.` : ""} Write one testimonial.`,
          },
        ],
        temperature: 0.9,
      }),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") ?? "";
    if (!text || text.length > 240) return fallback;
    return text;
  } catch {
    return fallback;
  }
}


const SUBJECTS_REGEN = [
  "a 32-year-old man with a short beard, wearing a navy hoodie, jeans, and white sneakers",
  "a 27-year-old woman with shoulder-length brown hair, in a black puffer jacket and beanie",
  "a 45-year-old man in a red plaid flannel and a worn ball cap, slight belly, friendly",
  "a 24-year-old woman in a denim jacket and white tee, dangling car keys in one hand",
  "a young mixed-race couple in their late 20s, casual fall jackets, leaning into each other",
  "a South Asian dad in his mid-30s holding his 3-year-old daughter on his hip",
  "a tradesman in his 40s in Carhartt work jacket, dusty work boots, after a shift",
  "a Black woman in her 30s in athleisure, hair tied back",
  "a 60-year-old man with grey hair and glasses in a fleece vest, thumbs up half-jokingly",
  "a Filipino woman in her late 20s in scrubs, just off a nursing shift, tired but smiling",
  "two best friends, both early 20s guys, one in a Raptors hoodie, fist-bumping in front of the car",
  "a single mom in her early 30s with her 8-year-old son standing proudly by the bumper",
];
const SETTINGS_REGEN = [
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
const FRAMINGS = [
  "shot from slightly low, full body and most of the car in frame, ~28mm phone lens",
  "tight three-quarter shot, head to mid-thigh, leaning on the front fender",
  "medium-wide, person and car centered, slightly off-axis",
  "from the side, person standing by the driver door, holding keys up casually",
  "shot at eye level from across the hood, the person mid-laugh",
];

function buildCandidPrompt(opts: {
  subject: string;
  scene: string;
  vehicle: string;
  framing: string;
  extra?: string;
}) {
  return [
    `Hyper-realistic CANDID iPhone snapshot of a real car-buyer standing next to the vehicle they just bought. NOT a professional photo. NOT a stock photo. NOT a studio headshot.`,
    `Subject: ${opts.subject}. Genuine relaxed expression — natural smile, half-laugh, or quietly proud look. Realistic skin texture with pores, slight imperfections, no airbrushing. Branded apparel (logos on hats, hoodies, t-shirts) is allowed. Natural personal items like a purse, backpack, sunglasses, or phone in hand are fine.`,
    `Vehicle: ${opts.vehicle}. MUST be a real, specific, recognizable production model with accurate manufacturer badges, grille, headlights, body lines, and wheels — do NOT generate a generic/fake car. Prefer compositions where the person's body naturally blocks the model badge / trim badge on the fender or tailgate. Photorealistic, plausible reflections, license plate blurred or partially out of frame.`,
    `Scene: ${opts.scene}. ABSOLUTELY NO surrounding business branding — no store names, no restaurant names, no gas-station brands, no dealership names, no readable storefront signage, no banners, no flags, no logos on buildings or walls. Background buildings must be completely generic with NO readable text.`,
    `Framing & camera: ${opts.framing}. Looks like an iPhone 14/15 photo a friend took — natural phone depth of field, mild sensor noise in shadows, slightly imperfect crop. Natural ambient light only — no rim light, no softbox, no studio lighting, no HDR halos.`,
    `Strictly forbid: surrounding store/restaurant/dealership signage or logos, glossy commercial advertising look, magazine cover lighting, model-agency posing, white seamless background, AI-generated waxy skin, text overlays, watermarks, generic/fake cars without real badges, coffee cups, takeout cups, water bottles, shopping bags.`,
    opts.extra?.trim() ? `Extra notes: ${opts.extra.trim()}` : "",
  ].filter(Boolean).join("\n");
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export async function runRegenerateHappyClientPhoto(
  input: { id: string; notes?: string; userId: string },
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

  const { data: client, error } = await supabase
    .from("happy_clients")
    .select("id, client_name, location, vehicle")
    .eq("id", input.id)
    .single();
  if (error || !client) throw new Error("Client not found");

  const vehicleStr =
    (client.vehicle as string | null)?.trim() ||
    "their real late-model used vehicle (pick one: a silver Toyota RAV4, a black Ford F-150, a white Honda Civic, a charcoal Hyundai Tucson, or a blue Mazda CX-5)";

  const prompt = buildCandidPrompt({
    subject: pick(SUBJECTS_REGEN),
    scene: pick(SETTINGS_REGEN),
    vehicle: vehicleStr,
    framing: pick(FRAMINGS),
    extra: input.notes,
  });

  const b64 = await genImage(apiKey, prompt);

  const { data: asset, error: aErr } = await supabase
    .from("brand_assets")
    .insert({
      kind: "happy_client" as never,
      label: `AI photo — ${client.client_name as string}`,
      mime: "image/png",
      data_base64: b64,
      created_by: input.userId,
    })
    .select("id").single();
  if (aErr) throw new Error(aErr.message);
  const photo_url = `/api/public/brand-asset/${asset!.id}.png`;

  const fallbackQuote = pick(QUOTES_NEW);
  const newQuote = await genTestimonial(
    apiKey,
    {
      name: (client.client_name as string) ?? "Customer",
      vehicle: vehicleStr,
      subject: undefined,
      scene: undefined,
    },
    fallbackQuote,
  );



  const { error: uErr } = await supabase
    .from("happy_clients")
    .update({ photo_url, quote: newQuote })
    .eq("id", input.id);
  if (uErr) throw new Error(uErr.message);

  return { id: input.id, photo_url, quote: newQuote };
}

const TEMPLATES_NEW = [
  { id: "dealership-handover", scene: "standing in front of a clean modern dealership showroom — large glass facade behind, polished pavement, golden hour light. Dealership building is generic with NO visible signage, logos, banners, or readable text anywhere" },
  { id: "dealership-showroom-interior", scene: "inside a bright dealership showroom — polished concrete floor, rows of new vehicles softly out of focus behind, overhead spotlight rigs. Completely unbranded — NO manufacturer logos on walls, NO posters, NO signage, NO readable text" },
  { id: "dealership-lot-rows", scene: "in a busy dealership lot with rows of other vehicles behind, salesperson silhouettes blurred in the distance. NO logos, NO banners, NO flags, NO signage of any kind" },
  { id: "dealership-front-doors", scene: "just outside the dealership entrance — sliding glass doors behind, a clean canopy overhead. Building is completely generic with NO signs, NO logos, NO readable storefront text" },
  { id: "dealership-night-lot", scene: "in a dealership lot at dusk, overhead pole lights glowing on wet pavement, rows of vehicles softly out of focus behind. NO logos, NO banners, NO readable signage" },
  { id: "dealership-delivery-bay", scene: "in a dealership delivery bay — clean tiled floor, a generic blank wall behind, soft indoor lighting. Completely unbranded interior" },
  { id: "white-studio-driveway", scene: "in a clean residential driveway with a white garage door behind, soft midday overcast light" },
  { id: "snowy-lot-winter", scene: "in a snowy dealership parking lot at midday, cold blue light, faint breath visible, rows of other cars softly blurred behind, NO signage or branding visible" },
  { id: "urban-golden-hour", scene: "on a quiet downtown street at golden hour, long warm shadows on asphalt, generic unbranded storefronts blurred behind" },
  { id: "mountain-vista", scene: "at a roadside pull-off with hazy mountains in the background, late afternoon" },
  { id: "neon-night-city", scene: "at night on a wet city street, faint ambient light reflecting on the paint, no readable signage" },
  { id: "forest-suv", scene: "at a forested trailhead, pine trees behind the vehicle, soft diffused daylight" },
  { id: "desert-sunset", scene: "in an open lot at sunset, warm orange sky, dust hanging in the air" },
  { id: "jobsite-pickup", scene: "at a construction jobsite, gravel underfoot, plain hi-vis vest (no company name) nearby" },
  { id: "family-suv-driveway", scene: "in a suburban cul-de-sac driveway, kids' chalk drawings faintly on the pavement" },
  { id: "highway-rest", scene: "at a highway rest stop, generic unmarked semi-trucks blurred in the distance" },
  { id: "evening-overpass", scene: "on an overpass at dusk, blurred city lights behind, mild ambient glow" },
  { id: "rainy-side-street", scene: "on a rainy side street, damp asphalt, soft overcast grey light, fallen leaves" },
  { id: "small-town-main", scene: "on a quiet small-town main street, blurred generic storefronts behind, no readable signs" },
  { id: "backyard-string-lights", scene: "in a backyard with a wood fence and string lights, late afternoon" },
];

// Combinatorial subject generation — produces a visually unique person every time
// by randomizing across many independent dimensions. The space is in the millions
// of combinations, so collisions are vanishingly rare. Name uniqueness is also
// enforced against existing rows in happy_clients before insert.

const ETHNICITIES = [
  "East Asian", "South Asian", "Southeast Asian", "Filipino", "Black", "African",
  "Afro-Caribbean", "Middle Eastern", "Persian", "Latino", "Latina", "Hispanic",
  "Indigenous First Nations", "Pacific Islander", "white", "mixed-race",
  "Mediterranean", "Eastern European",
];
const GENDERS = ["man", "woman", "non-binary person"] as const;
const AGES = ["19", "22", "24", "26", "28", "31", "33", "36", "39", "42", "45", "48", "52", "55", "58", "62", "67"];
const BUILDS = ["slim", "average build", "athletic build", "stocky", "tall and lanky", "short", "heavyset", "broad-shouldered", "petite"];
const HAIR_MEN = ["a fresh fade", "short cropped hair", "a buzz cut", "shoulder-length hair tied back", "wavy hair", "a man bun", "dreadlocks", "a balding crown", "salt-and-pepper hair", "thick curly hair", "a shaved head"];
const HAIR_WOMEN = ["long straight black hair", "shoulder-length brown hair", "curly red hair with freckles", "a blonde bob", "box braids", "a high ponytail", "a messy bun", "pixie-cut hair", "wavy chestnut hair past the shoulders", "a hijab", "grey hair pulled back", "dyed pastel-pink hair"];
const FACIAL_HAIR = ["clean-shaven", "with a short beard", "with a thick full beard", "with a goatee", "with stubble", "with a mustache"];
const SKIN_NOTES = ["with light freckles across the nose", "with a small mole on the cheek", "with a faint scar through one eyebrow", "with dimples when smiling", "with crow's-feet around the eyes", "with smooth clear skin", "with weathered tanned skin", "with rosy cheeks", "with acne scars on the cheeks", "with a sleeve tattoo on one forearm", "with a small neck tattoo", "with pierced ears", "with a nose ring", "with thick-rimmed glasses", "with wire-frame glasses", "with prescription sunglasses pushed up on head"];
const OUTFITS = [
  "in a plain navy hoodie, jeans, and white sneakers",
  "in a plain denim jacket over a white tee and dark jeans",
  "in a plain fitted bomber jacket and chinos",
  "in a plain black puffer jacket and a knit beanie",
  "in a red plaid flannel over a tee and worn jeans",
  "in plain solid-color nursing scrubs",
  "in a plain canvas work jacket and dusty work boots",
  "in plain athleisure — a zip-up and matching leggings",
  "in a fleece vest over a long-sleeve henley",
  "in a plain quarter-zip and slacks",
  "in an oversized cream knit sweater and jeans",
  "in a plain flannel shirt rolled to the elbows",
  "in a long wool peacoat over a turtleneck",
  "in a leather jacket over a plain tee",
  "in a Carhartt-style brown work jacket",
  "in a cable-knit cardigan and corduroys",
  "in a windbreaker and joggers",
  "in a chef's jacket, untied",
  "in office-casual — button-up shirt untucked, dark jeans",
  "in a varsity-style bomber and joggers",
  "in cargo pants and a plain t-shirt",
  "in a sundress and light cardigan",
  "in a tracksuit",
  "in a tank top showing arm tattoos and ripped jeans",
];
const ACCESSORIES = ["holding car keys in one hand", "phone in hand", "a coffee thermos tucked under one arm", "a small purse on the shoulder", "a backpack slung on one shoulder", "sunglasses pushed up on the head", "wedding ring visible", "a smartwatch on the wrist", "nothing in hand, arms relaxed at the sides", "hands tucked in jacket pockets", "one hand resting on the car's hood"];
const EXPRESSIONS = ["a quiet proud smile", "a wide genuine grin", "mid-laugh", "a relaxed half-smile", "a closed-mouth smile, slightly shy", "a confident smirk", "looking slightly off-camera with a small smile", "thumbs-up half-jokingly to camera"];
const COMPANIONS = ["", "", "", "", "", "with a toddler on one hip", "standing next to their partner (also visible, mid-30s, casually dressed)", "with their 8-year-old kid leaning into their side", "with a small dog on a leash beside them", "with an elderly parent next to them"];

const FIRST_NAMES = ["Jordan", "Priya", "Marcus", "Emily", "Dave", "Sarah", "Mike", "Tasha", "Chris", "Aisha", "Tyler", "Megan", "Raj", "Hannah", "Luis", "Grace", "Devon", "Brittany", "Frank", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Logan", "Mia", "Lucas", "Charlotte", "Amir", "Zara", "Kenji", "Mei", "Diego", "Camila", "Jamal", "Imani", "Owen", "Harper", "Wyatt", "Layla", "Caleb", "Nora", "Hudson", "Aria", "Levi", "Riley", "Quinn", "Eli", "Adriana", "Marco", "Yuki", "Ravi", "Anika", "Tariq", "Nadia", "Hassan", "Fatima", "Mateo", "Valentina", "Kai", "Leila", "Connor", "Bria", "Ibrahim", "Saanvi"];
const LAST_INITIALS = "ABCDEFGHJKLMNPRSTVWY".split("");

function buildSubject(seenNames: Set<string>): { name: string; desc: string } {
  const gender = pick(GENDERS as unknown as string[]);
  const isWoman = gender === "woman";
  const ethnicity = pick(ETHNICITIES);
  const age = pick(AGES);
  const build = pick(BUILDS);
  const hair = isWoman ? pick(HAIR_WOMEN) : pick(HAIR_MEN);
  const facial = isWoman || gender === "non-binary person" ? "" : (Math.random() < 0.55 ? pick(FACIAL_HAIR) : "clean-shaven");
  const skin = pick(SKIN_NOTES);
  const outfit = pick(OUTFITS);
  const accessory = pick(ACCESSORIES);
  const expression = pick(EXPRESSIONS);
  const companion = pick(COMPANIONS);

  const desc = [
    `a ${age}-year-old ${ethnicity} ${gender}, ${build}, ${hair}${facial ? ", " + facial : ""}, ${skin}, ${outfit}, ${accessory}, ${expression}${companion ? ", " + companion : ""}`,
  ].join("");

  // Unique-ish display name. Avoid collisions with existing rows.
  let name = "";
  for (let i = 0; i < 12; i++) {
    const candidate = `${pick(FIRST_NAMES)} ${pick(LAST_INITIALS)}.`;
    if (!seenNames.has(candidate)) { name = candidate; break; }
  }
  if (!name) name = `${pick(FIRST_NAMES)} ${pick(LAST_INITIALS)}${pick(LAST_INITIALS)}.`;
  return { name, desc };
}


const VEHICLES_NEW = [
  "a silver 2022 Toyota RAV4", "a black 2021 Ford F-150", "a white 2023 Honda Civic",
  "a charcoal 2022 Hyundai Tucson", "a blue 2021 Mazda CX-5", "a red 2020 Jeep Grand Cherokee",
  "a grey 2023 Kia Sportage", "a white 2022 Ram 1500", "a navy 2021 Subaru Outback",
  "a black 2023 Nissan Rogue", "a silver 2022 Chevrolet Equinox", "a white 2021 Volkswagen Tiguan",
  "a deep green 2023 Ford Bronco Sport", "a black 2022 Dodge Charger", "a champagne 2021 Lexus RX 350",
];

const QUOTES_NEW = [
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

const LOCATIONS_NEW = ["Surrey, BC", "Burnaby, BC", "Langley, BC", "Abbotsford, BC", "Coquitlam, BC", "Richmond, BC", "Maple Ridge, BC", "Chilliwack, BC", "New Westminster, BC", "Mission, BC"];

export async function runGenerateHappyClient(
  input: { notes?: string; userId: string },
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

  const template = pick(TEMPLATES_NEW);

  // Pull existing names so the new subject doesn't collide
  const { data: existingRows } = await supabase
    .from("happy_clients")
    .select("client_name");
  const seenNames = new Set<string>(
    (existingRows ?? []).map((r) => (r.client_name as string) ?? "").filter(Boolean),
  );
  const subject = buildSubject(seenNames);

  const vehicle = pick(VEHICLES_NEW);
  const quote = pick(QUOTES_NEW);
  const location = pick(LOCATIONS_NEW);
  const framing = pick(FRAMINGS);

  const prompt = buildCandidPrompt({
    subject: subject.desc,
    scene: `(template "${template.id}") ${template.scene}`,
    vehicle,
    framing,
    extra: input.notes,
  });

  const b64 = await genImage(apiKey, prompt);

  const { data: asset, error: aErr } = await supabase
    .from("brand_assets")
    .insert({
      kind: "happy_client" as never,
      label: `AI photo — ${subject.name}`,
      mime: "image/png",
      data_base64: b64,
      created_by: input.userId,
    })
    .select("id").single();
  if (aErr) throw new Error(aErr.message);
  const photo_url = `/api/public/brand-asset/${asset!.id}.png`;

  const vehicleLabel = vehicle.replace(/^a\s+/i, "").replace(/^(an?\s+)?/i, "");

  const aiQuote = await genTestimonial(
    apiKey,
    {
      name: subject.name,
      vehicle: vehicleLabel,
      subject: subject.desc,
      scene: template.scene,
    },
    quote,
  );

  const { data: maxRow } = await supabase
    .from("happy_clients")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow?.display_order as number | undefined) ?? 0) + 10;

  const { data: inserted, error: iErr } = await supabase
    .from("happy_clients")
    .insert({
      client_name: subject.name,
      location,
      vehicle: vehicleLabel,
      quote: aiQuote,
      photo_url,
      display_order: nextOrder,
      is_active: true,
      created_by: input.userId,
    })
    .select("id, client_name, location, vehicle, quote, photo_url, accent_color, display_order, is_active")
    .single();
  if (iErr) throw new Error(iErr.message);

  return { client: inserted };
}
