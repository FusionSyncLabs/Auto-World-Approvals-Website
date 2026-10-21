/**
 * Admin server functions for the Resources / blog section.
 * Generation itself runs as a background job (see job-handlers.server.ts).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BLOG_CATEGORY_OPTIONS = [
  "Car Buying",
  "Auto Financing",
  "Credit & Money",
  "Ownership & Maintenance",
  "Trade-Ins & Selling",
  "EVs & New Tech",
  "Canadian Driving",
] as const;

export type BlogAutopilot = {
  enabled: boolean;
  hour_local: number;
  days: number[];
  posts_per_run: number;
  topics: string;
  auto_publish: boolean;
  timezone?: string;
  last_run_at?: string | null;
  last_error?: string | null;
};

export const DEFAULT_AUTOPILOT: BlogAutopilot = {
  enabled: false,
  hour_local: 9,
  days: [1, 3, 5],
  posts_per_run: 1,
  topics: "",
  auto_publish: true,
  timezone: "America/Edmonton",
  last_run_at: null,
  last_error: null,
};

async function admin(userId: string) {
  const { requireAdmin } = await import("@/lib/admin-auth.server");
  return requireAdmin(userId);
}

export const listBlogPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await admin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, status, category, tags, cover_image_url, cover_alt, reading_minutes, auto_generated, published_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getBlogPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

const SaveSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(120),
  excerpt: z.string().max(400).nullable().optional(),
  body_md: z.string().min(1).max(120000),
  category: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
  cover_image_url: z.string().max(500).nullable().optional(),
  cover_alt: z.string().max(250).nullable().optional(),
  seo_title: z.string().max(160).nullable().optional(),
  seo_description: z.string().max(400).nullable().optional(),
  status: z.enum(["draft", "published"]),
});

export const saveBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin(context.userId);
    const { data: current } = await supabaseAdmin
      .from("blog_posts")
      .select("status, published_at")
      .eq("id", data.id)
      .maybeSingle();

    const publishedAt =
      data.status === "published"
        ? (current?.published_at as string | null) ?? new Date().toISOString()
        : null;

    const words = data.body_md.split(/\s+/).filter(Boolean).length;

    const { error } = await supabaseAdmin
      .from("blog_posts")
      .update({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt ?? null,
        body_md: data.body_md,
        category: data.category ?? null,
        tags: data.tags ?? [],
        cover_image_url: data.cover_image_url ?? null,
        cover_alt: data.cover_alt ?? null,
        seo_title: data.seo_title ?? null,
        seo_description: data.seo_description ?? null,
        status: data.status,
        published_at: publishedAt,
        reading_minutes: Math.max(2, Math.round(words / 210)),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBlogPostStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin(context.userId);
    const { error } = await supabaseAdmin
      .from("blog_posts")
      .update({
        status: data.status,
        published_at: data.status === "published" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin(context.userId);
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBlogAutopilot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await admin(context.userId);
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "blog_autopilot")
      .maybeSingle();
    return { ...DEFAULT_AUTOPILOT, ...((data?.value as Partial<BlogAutopilot>) ?? {}) };
  });

const AutopilotSchema = z.object({
  enabled: z.boolean(),
  hour_local: z.number().int().min(0).max(23),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  posts_per_run: z.number().int().min(1).max(3),
  topics: z.string().max(2000),
  auto_publish: z.boolean(),
  timezone: z.string().max(60).optional(),
});

export const saveBlogAutopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AutopilotSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "blog_autopilot")
      .maybeSingle();
    const merged = { ...DEFAULT_AUTOPILOT, ...((existing?.value as object) ?? {}), ...data };
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        { key: "blog_autopilot", value: merged as never, updated_by: context.userId, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return merged;
  });
