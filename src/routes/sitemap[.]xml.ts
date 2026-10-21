import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://autoworldapprovals.com";

interface SitemapEntry { path: string; changefreq?: string; priority?: string }

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/how-it-works", changefreq: "monthly", priority: "0.8" },
          { path: "/vehicles", changefreq: "monthly", priority: "0.8" },
          { path: "/sell-trade-in", changefreq: "monthly", priority: "0.8" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/faq", changefreq: "monthly", priority: "0.6" },
          { path: "/vehicle-financing/bc", changefreq: "monthly", priority: "0.7" },
          { path: "/vehicle-financing/alberta", changefreq: "monthly", priority: "0.7" },
          { path: "/financing/truck", changefreq: "monthly", priority: "0.7" },
          { path: "/financing/suv", changefreq: "monthly", priority: "0.7" },
          { path: "/financing/car", changefreq: "monthly", priority: "0.7" },
          { path: "/financing/ev", changefreq: "monthly", priority: "0.7" },
          { path: "/contact", changefreq: "monthly", priority: "0.6" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/consent", changefreq: "yearly", priority: "0.3" },
          { path: "/cookies", changefreq: "yearly", priority: "0.3" },
          { path: "/legal", changefreq: "yearly", priority: "0.3" },
          { path: "/blog", changefreq: "daily", priority: "0.7" },
        ];

        try {
          const { createClient } = await import("@supabase/supabase-js");
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
          const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              fetch: (input: RequestInfo | URL, init?: RequestInit) => {
                const h = new Headers(init?.headers);
                if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
                h.set("apikey", key);
                return fetch(input, { ...init, headers: h });
              },
            },
          });
          const { data } = await supabase
            .from("blog_posts")
            .select("slug")
            .eq("status", "published")
            .order("published_at", { ascending: false })
            .limit(500);
          for (const row of data ?? []) {
            entries.push({ path: `/blog/${(row as { slug: string }).slug}`, changefreq: "monthly", priority: "0.6" });
          }
        } catch (e) {
          console.error("[sitemap] blog posts unavailable", e);
        }

        const urls = entries.map((e) => `  <url><loc>${BASE_URL}${e.path}</loc>${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority ? `<priority>${e.priority}</priority>` : ""}</url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
