import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const LEGAL_DOC_SLUGS = ["privacy", "terms", "consent", "cookies", "legal"] as const;
export type LegalDocSlug = typeof LEGAL_DOC_SLUGS[number];

export const LEGAL_DOC_META: Record<LegalDocSlug, { title: string; publicPath: string; description: string }> = {
  privacy: { title: "Privacy Policy", publicPath: "/privacy", description: "How personal information is collected, used and protected." },
  terms: { title: "Terms of Use", publicPath: "/terms", description: "The terms governing use of the Auto World Approvals platform." },
  consent: { title: "Credit Application Consent", publicPath: "/consent", description: "Consent users give when submitting a pre-qualification application." },
  cookies: { title: "Cookie Policy", publicPath: "/cookies", description: "How cookies and similar technologies are used on the platform." },
  legal: { title: "Legal Agreements (index)", publicPath: "/legal", description: "Overview page linking to all legal documents." },
};

async function getAdminClient(userId: string) {
  const { requireAdmin } = await import("@/lib/admin-auth.server");
  return requireAdmin(userId);
}

export const listLegalDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdminClient(context.userId);
    const { data, error } = await supabaseAdmin
      .from("legal_documents")
      .select("id, slug, title, effective_date, updated_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getLegalDoc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { slug: string }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdminClient(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("legal_documents")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveLegalDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { slug: string; title: string; body_md: string; effective_date?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdminClient(context.userId);
    const { error } = await supabaseAdmin
      .from("legal_documents")
      .upsert(
        {
          slug: data.slug,
          title: data.title,
          body_md: data.body_md,
          effective_date: data.effective_date || new Date().toISOString().slice(0, 10),
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLegalDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { slug: string }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdminClient(context.userId);
    const { error } = await supabaseAdmin.from("legal_documents").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RewriteSchema = z.object({
  slug: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  currentBody: z.string().max(80000),
  prompt: z.string().trim().min(3).max(4000),
});

export const rewriteLegalDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof RewriteSchema>) => RewriteSchema.parse(i))
  .handler(async ({ data, context }) => {
    await getAdminClient(context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured.");

    const system = `You are a senior Canadian legal/compliance writer specializing in PIPEDA, BC PIPA, AB PIPA and CASL.
You rewrite legal documents for a consumer-finance lead-generation website called Auto World Approvals (operated by Merk Digital Ltd., BC, Canada).

Strict rules:
- Output ONLY clean GitHub-Flavored Markdown — no preface, no commentary, no code fences around the whole document.
- Use # for the document title, ## for top-level sections, ### for subsections.
- Keep the company facts accurate: company name "Merk Digital Ltd.", brand "Auto World Approvals", province "British Columbia", service area "BC and Alberta", contact email "admin@autoworldapprovals.com".
- Do NOT invent SIN/government-ID collection, banking credentials collection, or anything Auto World Approvals does not do.
- Plain, professional Canadian English. No emojis. No marketing fluff.
- Always include an "Effective Date" line near the top.
- Preserve required legal substance — if the user's prompt does not address a section that exists today, keep that section.`;

    const user = `Document slug: ${data.slug}
Document title: ${data.title}

CURRENT MARKDOWN (may be empty for first generation):
"""
${data.currentBody || "(no existing content — generate a complete, production-ready document from scratch)"}
"""

REWRITE INSTRUCTIONS FROM ADMIN:
"""
${data.prompt}
"""

Return the complete updated document in Markdown.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached. Please wait a moment and try again.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in your workspace.");
    if (!res.ok) {
      const t = await res.text();
      console.error("[rewriteLegalDoc] AI error", res.status, t);
      throw new Error("AI generation failed.");
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("AI returned an empty response.");
    return { markdown: content };
  });
