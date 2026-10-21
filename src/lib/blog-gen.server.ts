/**
 * Server-only AI generation for the Resources / blog section.
 *
 * Produces genuinely useful, human-sounding articles about cars, buying,
 * ownership costs, credit and financing in Canada — never salesy, never
 * obviously AI-written, and not about Auto World Approvals itself.
 *
 * Cover images are generated with the image gateway and stored as
 * `brand_assets` rows (kind = 'blog'), served through
 * `/api/public/blog-image/<seo-file-name>-<uuid>.png` so the file name
 * itself carries SEO keywords.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Supa = typeof supabaseAdmin;

const CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_URL = "https://ai.gateway.lovable.dev/v1/images/generations";

export const BLOG_CATEGORIES = [
  "Car Buying",
  "Auto Financing",
  "Credit & Money",
  "Ownership & Maintenance",
  "Trade-Ins & Selling",
  "EVs & New Tech",
  "Canadian Driving",
] as const;

function gatewayError(status: number, text: string) {
  if (status === 429) return new Error("AI rate limit hit — try again in a moment.");
  if (status === 402) return new Error("Workspace AI credits exhausted.");
  return new Error(`AI request failed (${status}): ${text.slice(0, 240)}`);
}

async function chat(apiKey: string, messages: unknown[], opts: { model?: string; temperature?: number } = {}) {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-2.5-pro",
      messages,
      temperature: opts.temperature ?? 0.85,
    }),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""));
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty AI response.");
  return text;
}

async function genImage(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(IMAGE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""));
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from the image model.");
  return b64;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-|-$/g, "");
}

export function blogImageUrl(id: string, slug: string) {
  const name = slugify(slug || "auto-world-approvals-article").slice(0, 60) || "article";
  return `/api/public/blog-image/${name}-${id}.png`;
}

function readingMinutes(md: string) {
  const words = md.split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 210));
}

function stripFences(text: string) {
  return text.replace(/^```(?:json|markdown|md)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function parseJson<T>(raw: string): T {
  const cleaned = stripFences(raw);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

const HOUSE_STYLE = `You are a seasoned Canadian automotive journalist who has spent 15 years around dealerships, lenders and service bays. You write practical consumer guides for a Western-Canadian audience (British Columbia and Alberta).

Non-negotiable style rules:
- Write like a person, not a content farm. Vary sentence length. Use plain words. Contractions are fine.
- NEVER use these tell-tale phrases: "in today's fast-paced world", "delve", "navigate the landscape", "it's important to note", "unlock", "elevate", "game-changer", "when it comes to", "in conclusion", "furthermore", "moreover", "leverage", "robust", "seamless", "tapestry", "testament".
- No em-dash overuse, no bulleted lists of three adjectives, no rhetorical question openers.
- Be specific and useful: real numbers, real ranges, real trade-offs, real Canadian context (GST/PST, provincial rules, winter driving, insurance in BC vs AB, typical rates).
- Never invent statistics attributed to a named source. If you use a figure, frame it as a typical range, not a cited fact.
- Do NOT promote, name, or link Auto World Approvals anywhere in the body. This is editorial content, not an ad.
- No fake author bios, no testimonials, no "as an AI".
- Give the reader something they can act on today.

Formatting:
- GitHub-Flavored Markdown. Do NOT include the H1 title in the body — start with an opening paragraph.
- Use ## for sections, ### sparingly, short paragraphs, occasional bullet list or small table where it genuinely helps.
- 900–1400 words.`;

type Drafted = {
  title: string;
  slug: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  category: string;
  tags: string[];
  body_md: string;
  cover_prompt: string;
  cover_alt: string;
};

async function pickTopic(
  apiKey: string,
  existingTitles: string[],
  direction?: string,
): Promise<{ topic: string; category: string; angle: string }> {
  const raw = await chat(
    apiKey,
    [
      {
        role: "system",
        content:
          "You are an SEO editor planning evergreen articles for a Canadian car-buying and auto-financing resource hub. Return JSON only.",
      },
      {
        role: "user",
        content: `Pick ONE fresh article topic that real people search for. It must be genuinely useful, evergreen or seasonally relevant, and about cars, car buying, ownership costs, credit, insurance, trade-ins, or financing in Canada (BC/Alberta focus). It must NOT be about any specific company.

Avoid duplicating these existing article titles:
${existingTitles.slice(0, 60).map((t) => `- ${t}`).join("\n") || "(none yet)"}

${direction ? `Extra direction from the editor (follow it closely):\n"""\n${direction}\n"""` : ""}

Return JSON: {"topic": "...", "category": "one of: ${BLOG_CATEGORIES.join(" | ")}", "angle": "one sentence on the specific angle and who it helps"}`,
      },
    ],
    { temperature: 1 },
  );
  const parsed = parseJson<{ topic: string; category: string; angle: string }>(raw);
  return {
    topic: parsed.topic,
    category: BLOG_CATEGORIES.includes(parsed.category as never) ? parsed.category : "Car Buying",
    angle: parsed.angle ?? "",
  };
}

async function draftArticle(
  apiKey: string,
  topic: string,
  category: string,
  angle: string,
  direction?: string,
): Promise<Drafted> {
  const raw = await chat(apiKey, [
    { role: "system", content: HOUSE_STYLE },
    {
      role: "user",
      content: `Write the article.

Topic: ${topic}
Category: ${category}
Angle: ${angle}
${direction ? `Editor direction (must be followed): """${direction}"""` : ""}

Return ONLY minified JSON with exactly these keys:
{
 "title": "compelling, specific, under 65 characters, no clickbait",
 "slug": "kebab-case-url-slug",
 "excerpt": "1 sentence, 140 characters max, plain language",
 "seo_title": "under 60 characters, includes the main keyword",
 "seo_description": "under 155 characters, includes the main keyword, reads naturally",
 "category": "${category}",
 "tags": ["3-6 short lowercase keyword tags"],
 "body_md": "the full markdown article",
 "cover_prompt": "a detailed photography art-direction prompt for the cover image: real-world Canadian scene relevant to the topic, DSLR photojournalism, natural light, no text or logos in the image",
 "cover_alt": "descriptive alt text under 120 characters, keyword-aware, describes what is actually in the photo"
}`,
    },
  ]);
  const parsed = parseJson<Drafted>(raw);
  if (!parsed.title || !parsed.body_md) throw new Error("The AI draft was incomplete — try again.");
  parsed.slug = slugify(parsed.slug || parsed.title);
  parsed.tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6).map(String) : [];
  return parsed;
}

function coverImagePrompt(prompt: string) {
  return `Editorial cover photograph for a Canadian car-and-money article.

Art direction: ${prompt}

Hard requirements:
- Photorealistic DSLR photojournalism. Natural light. Shallow depth of field. Cinematic but believable.
- Landscape 16:9 composition, magazine-quality, sharp focus, no motion blur.
- Absolutely NO text, NO words, NO logos, NO watermarks, NO brand badges, NO license-plate numbers anywhere in the image.
- Real Canadian context where people appear: everyday clothing, natural expressions, no stock-photo grins.
- Do not produce illustrations, 3D renders, or AI-looking surrealism.`;
}

async function storeCover(
  supabase: Supa,
  b64: string,
  label: string,
  prompt: string,
  userId: string | null,
) {
  const { data, error } = await supabase
    .from("brand_assets")
    .insert({
      kind: "blog",
      label: label.slice(0, 180),
      prompt: prompt.slice(0, 4000),
      mime: "image/png",
      data_base64: b64,
      created_by: userId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

async function uniqueSlug(supabase: Supa, base: string, ignoreId?: string) {
  let slug = base || "article";
  for (let i = 0; i < 25; i++) {
    const q = supabase.from("blog_posts").select("id").eq("slug", slug).limit(1);
    const { data } = ignoreId ? await q.neq("id", ignoreId) : await q;
    if (!data?.length) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Create a brand-new article (topic chosen by AI unless `topic` given). */
export async function runBlogGenerate(
  input: { topic?: string; direction?: string; publish?: boolean; userId: string | null },
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI service is not configured.");

  const { data: recent } = await supabase
    .from("blog_posts")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(60);
  const titles = (recent ?? []).map((r) => r.title as string);

  const chosen = input.topic?.trim()
    ? { topic: input.topic.trim(), category: "Car Buying", angle: "" }
    : await pickTopic(apiKey, titles, input.direction);

  const draft = await draftArticle(apiKey, chosen.topic, chosen.category, chosen.angle, input.direction);
  const slug = await uniqueSlug(supabase, draft.slug);

  let coverUrl: string | null = null;
  try {
    const b64 = await genImage(apiKey, coverImagePrompt(draft.cover_prompt));
    const assetId = await storeCover(supabase, b64, `Blog cover — ${draft.title}`, draft.cover_prompt, input.userId);
    coverUrl = blogImageUrl(assetId, slug);
  } catch (e) {
    console.error("[blog] cover generation failed", e);
  }

  const publish = input.publish !== false;
  const { data: row, error } = await supabase
    .from("blog_posts")
    .insert({
      slug,
      title: draft.title,
      excerpt: draft.excerpt?.slice(0, 300) ?? null,
      body_md: draft.body_md,
      cover_image_url: coverUrl,
      cover_alt: draft.cover_alt?.slice(0, 200) ?? null,
      category: draft.category,
      tags: draft.tags,
      reading_minutes: readingMinutes(draft.body_md),
      seo_title: draft.seo_title?.slice(0, 120) ?? null,
      seo_description: draft.seo_description?.slice(0, 300) ?? null,
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
      author_id: input.userId,
      auto_generated: true,
      gen_notes: input.direction ?? null,
    } as never)
    .select("id, slug, title")
    .single();
  if (error) throw new Error(error.message);
  return { id: row!.id as string, slug: row!.slug as string, title: row!.title as string };
}

/** Rewrite an existing article body with optional extra direction. */
export async function runBlogRewrite(
  input: { id: string; direction?: string; userId: string | null },
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI service is not configured.");

  const { data: post, error: pErr } = await supabase
    .from("blog_posts")
    .select("id, slug, title, body_md, category, excerpt")
    .eq("id", input.id)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!post) throw new Error("Article not found.");

  const raw = await chat(apiKey, [
    { role: "system", content: HOUSE_STYLE },
    {
      role: "user",
      content: `Rewrite and improve this existing article. Keep what works, fix what doesn't, and make it read even more human.

Current title: ${post.title}
Current category: ${post.category ?? "Car Buying"}

CURRENT MARKDOWN:
"""
${(post.body_md as string).slice(0, 30000)}
"""

${input.direction ? `Editor direction (must be followed):\n"""\n${input.direction}\n"""` : "No extra direction — just make it sharper, more specific and more useful."}

Return ONLY minified JSON:
{"title":"...","excerpt":"...","seo_title":"...","seo_description":"...","tags":["..."],"body_md":"..."}`,
    },
  ]);
  const upd = parseJson<{
    title: string;
    excerpt: string;
    seo_title: string;
    seo_description: string;
    tags: string[];
    body_md: string;
  }>(raw);

  const { error } = await supabase
    .from("blog_posts")
    .update({
      title: upd.title || (post.title as string),
      excerpt: upd.excerpt?.slice(0, 300) ?? post.excerpt,
      seo_title: upd.seo_title?.slice(0, 120) ?? null,
      seo_description: upd.seo_description?.slice(0, 300) ?? null,
      tags: Array.isArray(upd.tags) ? upd.tags.slice(0, 6).map(String) : [],
      body_md: upd.body_md || (post.body_md as string),
      reading_minutes: readingMinutes(upd.body_md || (post.body_md as string)),
      gen_notes: input.direction ?? null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { id: input.id, title: upd.title };
}

/** Regenerate just the cover image, optionally with extra direction. */
export async function runBlogImage(
  input: { id: string; direction?: string; userId: string | null },
  supabase: Supa,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI service is not configured.");

  const { data: post, error: pErr } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, category")
    .eq("id", input.id)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!post) throw new Error("Article not found.");

  const artRaw = await chat(
    apiKey,
    [
      {
        role: "system",
        content:
          "You are a photo editor writing art-direction briefs for editorial photography. Return JSON only. Never request text or logos in the image.",
      },
      {
        role: "user",
        content: `Article title: ${post.title}
Category: ${post.category ?? ""}
Summary: ${post.excerpt ?? ""}
${input.direction ? `Editor direction (must be followed): """${input.direction}"""` : ""}

Return JSON: {"cover_prompt":"detailed photography brief, real Canadian setting, natural light, no text/logos","cover_alt":"alt text under 120 characters describing the photo"}`,
      },
    ],
    { model: "google/gemini-2.5-flash", temperature: 0.9 },
  );
  const art = parseJson<{ cover_prompt: string; cover_alt: string }>(artRaw);

  const b64 = await genImage(apiKey, coverImagePrompt(art.cover_prompt));
  const assetId = await storeCover(
    supabase,
    b64,
    `Blog cover — ${post.title}`,
    art.cover_prompt,
    input.userId,
  );
  const url = blogImageUrl(assetId, post.slug as string);

  const { error } = await supabase
    .from("blog_posts")
    .update({
      cover_image_url: url,
      cover_alt: art.cover_alt?.slice(0, 200) ?? null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { id: input.id, cover_image_url: url };
}
