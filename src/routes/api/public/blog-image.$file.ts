import { createFileRoute } from "@tanstack/react-router";

/**
 * Serves blog cover images with an SEO-friendly file name:
 *   /api/public/blog-image/<keyword-slug>-<uuid>.png
 */
export const Route = createFileRoute("/api/public/blog-image/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params.file ?? "").replace(/\.(png|jpg|jpeg|webp)$/i, "");
        const match = raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
        if (!match) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("brand_assets")
          .select("mime, data_base64")
          .eq("id", match[1])
          .maybeSingle();
        if (error || !data) return new Response("Not found", { status: 404 });

        const bytes = Uint8Array.from(atob(data.data_base64 as string), (c) => c.charCodeAt(0));
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": (data.mime as string) || "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
