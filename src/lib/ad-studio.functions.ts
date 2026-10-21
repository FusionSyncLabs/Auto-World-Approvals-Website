import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


export const AD_SIZES = {
  square_1x1: { label: "Square 1:1 (Feed)", spec: "1024×1024" },
  portrait_4x5: { label: "Portrait 4:5 (Feed)", spec: "4:5" },
  story_9x16: { label: "Story 9:16", spec: "9:16" },
  landscape_16x9: { label: "Landscape 16:9", spec: "16:9" },
} as const;
export type AdSizeKey = keyof typeof AD_SIZES;

export type LibraryKind = "ad_competitor_ref" | "ad_client_photo" | "ad_generated";

export type AdOverlays = {
  headline?: string;
  tagline?: string;
  logoUrl?: string | null;
  textZone?: "left" | "right" | "center";
  textColor?: "light" | "dark";
  templateId?: string;
} | null;

export type AdAsset = {
  id: string;
  kind: LibraryKind;
  label: string;
  platform: string | null;
  prompt: string | null;
  pair_id: string | null;
  created_at: string;
  url: string;
  overlays: AdOverlays;
};


async function requireAdmin(userId: string) {
  const { requireAdmin } = await import("@/lib/admin-auth.server");
  return requireAdmin(userId);
}

function mimeToExt(mime: string | null | undefined) {
  if (!mime) return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

// ============ LIST ============

export const listAdAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind: LibraryKind }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("brand_assets")
      .select("id, kind, label, platform, prompt, pair_id, mime, created_at, metadata")
      .eq("kind", data.kind)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Array<{
      id: string;
      kind: LibraryKind;
      label: string;
      platform: string | null;
      prompt: string | null;
      pair_id: string | null;
      mime: string | null;
      created_at: string;
      metadata: { overlays?: AdOverlays } | null;
    }>).map((r) => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      platform: r.platform,
      prompt: r.prompt,
      pair_id: r.pair_id,
      created_at: r.created_at,
      url: `/api/public/brand-asset/${r.id}.${mimeToExt(r.mime)}`,
      overlays: r.metadata?.overlays ?? null,
    })) as AdAsset[];
  });


// ============ UPLOAD (competitor refs + client photos) ============

export const uploadAdLibraryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    kind: "ad_competitor_ref" | "ad_client_photo";
    label: string;
    notes?: string;
    mime: string;
    data_base64: string;
  }) => {
    if (!i.data_base64) throw new Error("Missing image data");
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(i.mime)) throw new Error("Unsupported image type (PNG, JPG, WebP)");
    if (i.data_base64.length > 8_000_000) throw new Error("Image too large (max ~6MB)");
    return i;
  })
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: data.kind as never,
        label: (data.label || "Untitled").slice(0, 120),
        prompt: (data.notes ?? "").slice(0, 4000),
        mime: data.mime,
        data_base64: data.data_base64,
        created_by: context.userId,
      })
      .select("id, mime")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string, url: `/api/public/brand-asset/${row!.id}.${mimeToExt(row!.mime as string)}` };
  });

// ============ DELETE ============

export const deleteAdAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("brand_assets")
      .delete()
      .eq("id", data.id)
      .in("kind", ["ad_competitor_ref", "ad_client_photo", "ad_generated"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ SAVE EDITED (from canvas editor) ============

export const saveEditedAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().trim().min(1).max(200),
        size: z.string().trim().max(60).optional().nullable(),
        dataBase64: z.string().min(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const b64 = data.dataBase64.replace(/^data:image\/\w+;base64,/, "");
    const { data: row, error } = await supabaseAdmin
      .from("brand_assets")
      .insert({
        kind: "ad_generated" as never,
        label: data.label,
        platform: data.size ?? null,
        prompt: "Edited in canvas editor",
        mime: "image/png",
        data_base64: b64,
        created_by: context.userId,
        metadata: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string, url: `/api/public/brand-asset/${row!.id}.png` };
  });

// ============ REUSE TEMPLATE (re-run generation with different client photo) ============
//
// Re-runs the original `ad_generate` pipeline using the source ad's stored
// generation params (size, reference ads, prompt, includeLogo) but swaps in
// the newly chosen client photo (or none, for a car-only ad). Returns the
// queued job id — the new ad shows up in the library when the job finishes.

export const reapplyAdTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sourceId: z.string().uuid(),
        clientPhotoIds: z.array(z.string().uuid()).max(20).default([]),
        label: z.string().trim().min(1).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);

    const { data: src, error: srcErr } = await supabaseAdmin
      .from("brand_assets")
      .select("id, label, platform, metadata")
      .eq("id", data.sourceId)
      .eq("kind", "ad_generated")
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!src) throw new Error("Source ad not found");

    const meta = (src.metadata as {
      generation?: {
        size?: string;
        prompt?: string;
        competitorRefIds?: string[];
        includeLogo?: boolean;
      };
    } | null) ?? {};
    const gen = meta.generation;
    if (!gen?.size) {
      throw new Error("This ad was generated with an older version that can't be reused. Generate a fresh one and try reusing that.");
    }

    // Validate provided client photo IDs belong to this user's library
    if (data.clientPhotoIds.length > 0) {
      const { data: photos, error: pErr } = await supabaseAdmin
        .from("brand_assets")
        .select("id")
        .in("id", data.clientPhotoIds)
        .eq("kind", "ad_client_photo");
      if (pErr) throw new Error(pErr.message);
      if (!photos || photos.length === 0) throw new Error("No valid client photos selected");
    }

    const newLabel = (data.label ?? `${src.label as string} (re-applied)`).slice(0, 160);

    const { data: job, error: jErr } = await supabaseAdmin
      .from("jobs")
      .insert({
        user_id: context.userId,
        kind: "ad_generate",
        label: newLabel,
        input: {
          label: newLabel,
          size: gen.size,
          prompt: gen.prompt ?? "",
          competitorRefIds: gen.competitorRefIds ?? [],
          clientPhotoIds: data.clientPhotoIds,
          includeLogo: gen.includeLogo !== false,
          userId: context.userId,
        } as never,
      })
      .select("id")
      .single();
    if (jErr) throw new Error(jErr.message);

    return { jobId: job!.id as string, label: newLabel };
  });


// ============ SUGGEST CREATIVE DIRECTION (AI) ============

export const suggestAdCreativeDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { vibe?: string }) => i)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const vibe = (data.vibe ?? "").trim();
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write punchy, scroll-stopping creative direction briefs for ad creatives — Auto World Approvals, a premium Canadian auto-financing brand. Tap into CURRENT events, CURRENT pop culture, trending memes/shows/music/sports, and humour. Keep it tasteful and on-brand (premium fintech meets dealership). Reference at most one current cultural moment per brief, never name copyrighted characters, never use real celebrity names — describe the vibe instead. Always single paragraph, 2-4 sentences, no emojis, no hashtags, no quotes.",
          },
          {
            role: "user",
            content: vibe
              ? `Write ONE fresh creative direction brief for a social ad. Lean into this vibe/topic: """${vibe}""". Return only the brief text.`
              : "Write ONE fresh creative direction brief for a social ad — something current, witty, culturally aware. Return only the brief text.",
          },
        ],
        temperature: 1,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit hit. Try again in a moment.");
      if (res.status === 402) throw new Error("Workspace AI credits exhausted.");
      throw new Error(`Suggestion failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("Empty suggestion");
    return { suggestion: text };
  });
