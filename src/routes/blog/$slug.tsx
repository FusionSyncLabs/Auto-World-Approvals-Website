// @ts-nocheck
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublishedPost } from "@/lib/blog-public.functions";
import { Clock, ArrowLeft } from "lucide-react";

const BASE = "https://autoworldapprovals.com";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const res = await getPublishedPost({ data: { slug: params.slug } });
    if (!res) throw notFound();
    return res;
  },
  head: ({ loaderData, params }) => {
    const post = loaderData?.post;
    if (!post) return { meta: [{ title: "Article | Auto World Approvals" }] };
    const url = `${BASE}/blog/${params.slug}`;
    const image = post.cover_image_url ? `${BASE}${post.cover_image_url}` : null;
    const title = post.seo_title || `${post.title} | Auto World Approvals`;
    const description = post.seo_description || post.excerpt || "";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:title", content: post.seo_title || post.title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description,
            ...(image ? { image: [image] } : {}),
            datePublished: post.published_at,
            dateModified: post.updated_at ?? post.published_at,
            mainEntityOfPage: url,
            author: { "@type": "Organization", name: "Auto World Approvals" },
            publisher: { "@type": "Organization", name: "Auto World Approvals" },
          }),
        },
      ],
    };
  },
  errorComponent: () => (
    <SiteLayout>
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">We couldn't load this article</h1>
        <Link to="/blog" className="mt-4 inline-block text-[var(--electric)] underline">
          Back to all guides
        </Link>
      </div>
    </SiteLayout>
  ),
  notFoundComponent: () => (
    <SiteLayout>
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Article not found</h1>
        <Link to="/blog" className="mt-4 inline-block text-[var(--electric)] underline">
          Back to all guides
        </Link>
      </div>
    </SiteLayout>
  ),
  component: BlogPost,
});

function BlogPost() {
  const { post, related } = Route.useLoaderData();
  const html = DOMPurify.sanitize(marked.parse(post.body_md, { gfm: true, breaks: false }) as string);

  return (
    <SiteLayout>
      <article>
        <header className="bg-hero text-white">
          <div className="container mx-auto max-w-3xl px-4 py-14 lg:px-8 lg:py-20">
            <Link to="/blog" className="mb-6 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> All guides
            </Link>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {post.category && <Badge className="bg-white/15 text-white hover:bg-white/25">{post.category}</Badge>}
              <span className="inline-flex items-center gap-1 text-xs text-white/70">
                <Clock className="h-3 w-3" /> {post.reading_minutes} min read
              </span>
              {post.published_at && (
                <span className="text-xs text-white/70">
                  {new Date(post.published_at).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
            <h1 className="text-balance text-3xl font-bold leading-tight lg:text-4xl">{post.title}</h1>
            {post.excerpt && <p className="mt-4 text-lg text-white/75">{post.excerpt}</p>}
          </div>
        </header>

        {post.cover_image_url && (
          <div className="container mx-auto max-w-4xl px-4 lg:px-8">
            <img
              src={post.cover_image_url}
              alt={post.cover_alt ?? post.title}
              className="-mt-8 w-full rounded-2xl border border-border object-cover shadow-lg lg:-mt-12"
            />
          </div>
        )}

        <div className="container mx-auto max-w-3xl px-4 py-12 lg:px-8 lg:py-16">
          <div
            className="prose prose-slate max-w-none text-foreground/85 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1 [&_table]:my-5 [&_table]:w-full [&_th]:border-b [&_th]:p-2 [&_th]:text-left [&_td]:border-b [&_td]:p-2"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {post.tags?.length ? (
            <div className="mt-10 flex flex-wrap gap-2">
              {post.tags.map((t: string) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-12 rounded-2xl border border-border bg-soft p-6 text-center">
            <p className="font-display text-xl font-bold">Wondering what you'd actually qualify for?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              A short financing inquiry takes a few minutes, is free and has no obligation.
            </p>
            <Button asChild className="mt-4">
              <Link to="/apply">Check Financing Options</Link>
            </Button>
          </div>
        </div>

        {related.length > 0 && (
          <section className="border-t border-border bg-soft">
            <div className="container mx-auto max-w-5xl px-4 py-14 lg:px-8">
              <h2 className="mb-6 font-display text-xl font-bold">Keep reading</h2>
              <div className="grid gap-5 sm:grid-cols-3">
                {related.map((r: any) => (
                  <Link
                    key={r.slug}
                    to="/blog/$slug"
                    params={{ slug: r.slug }}
                    className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-[var(--electric)]/50"
                  >
                    {r.cover_image_url && (
                      <img
                        src={r.cover_image_url}
                        alt={r.cover_alt ?? r.title}
                        className="h-32 w-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="p-4">
                      <p className="font-semibold leading-snug group-hover:text-[var(--electric)]">{r.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{r.reading_minutes} min read</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
    </SiteLayout>
  );
}
