import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/brand-asset/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const rawId = params.id ?? "";
        // strip optional image extension so /api/brand-asset/<uuid>.png works
        const id = rawId.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("brand_assets")
          .select("mime, data_base64")
          .eq("id", id)
          .maybeSingle();
        if (error || !data) return new Response("Not found", { status: 404 });
        const bytes = Uint8Array.from(atob(data.data_base64), (c) => c.charCodeAt(0));
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": data.mime || "image/png",
            "Cache-Control": new URL(request.url).searchParams.has("v")
              ? "public, max-age=60, must-revalidate"
              : "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
