import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, category, tags, cover_image_url, cover_alt, reading_minutes, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(120);
  return data ?? [];
});

export const getPublishedPost = createServerFn({ method: "GET" })
  .inputValidator((i: { slug: string }) => i)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    if (!supabase) return null;
    const { data: row } = await supabase
      .from("blog_posts")
      .select(
        "slug, title, excerpt, body_md, category, tags, cover_image_url, cover_alt, reading_minutes, seo_title, seo_description, published_at, updated_at",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!row) return null;

    const { data: more } = await supabase
      .from("blog_posts")
      .select("slug, title, excerpt, cover_image_url, cover_alt, reading_minutes, published_at")
      .eq("status", "published")
      .neq("slug", data.slug)
      .order("published_at", { ascending: false })
      .limit(3);

    return { post: row, related: more ?? [] };
  });
