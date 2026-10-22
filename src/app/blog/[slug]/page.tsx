import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/link";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ArrowLeft } from "lucide-react";
import { fetchPublishedPost, fetchPublishedPosts } from "@/lib/blog-data";

const BASE = "https://autoworldapprovals.com";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await fetchPublishedPosts();
  if (!posts || posts.length === 0) {
    return [{ slug: "getting-started" }];
  }
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const res = await fetchPublishedPost(slug);
  if (!res) return { title: "Article Not Found | Auto World Approvals" };

  const { post } = res;
  const url = `${BASE}/blog/${slug}`;
  const image = post.cover_image_url ? (post.cover_image_url.startsWith("http") ? post.cover_image_url : `${BASE}${post.cover_image_url}`) : null;
  const title = post.seo_title || `${post.title} | Auto World Approvals`;
  const description = post.seo_description || post.excerpt || "";

  return {
    title,
    description,
    openGraph: {
      type: "article",
      title: post.seo_title || post.title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.seo_title || post.title,
      description,
      images: image ? [image] : undefined,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const res = await fetchPublishedPost(slug);
  if (!res) notFound();

  const { post, related } = res;
  const html = DOMPurify.sanitize(marked.parse(post.body_md || "", { gfm: true, breaks: false }) as string);

  return (
    <SiteLayout>
      <article>
        <header className="bg-hero text-white">
          <div className="container mx-auto max-w-3xl px-4 py-14 lg:px-8 lg:py-20">
            <Link href="/blog" className="mx-auto mb-6 flex min-h-11 w-fit max-w-full items-center justify-center gap-2 rounded-sm text-sm text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:mx-0">
              <ArrowLeft className="h-4 w-4" /> All guides
            </Link>
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {post.category && <Badge className="max-w-full bg-white/15 text-center text-white hover:bg-white/25 [overflow-wrap:anywhere]">{post.category}</Badge>}
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
            <h1 className="mobile-heading text-balance text-3xl font-bold leading-tight [overflow-wrap:anywhere] lg:text-4xl">{post.title}</h1>
            {post.excerpt && <p className="mobile-body mt-4 text-lg text-white/75 [overflow-wrap:anywhere]">{post.excerpt}</p>}
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
            className="prose prose-slate min-w-0 max-w-none text-foreground/85 [overflow-wrap:anywhere] max-sm:[&_h1]:text-center [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground max-sm:[&_h2]:text-center [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold max-sm:[&_h3]:text-center max-sm:[&_h4]:text-center max-sm:[&_h5]:text-center max-sm:[&_h6]:text-center [&_p]:mt-3 [&_p]:leading-relaxed max-sm:[&_p]:text-justify max-sm:[&_p]:hyphens-auto [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1 [&_img]:h-auto [&_img]:max-w-full [&_table]:my-5 [&_table]:block [&_table]:w-full [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:text-left [&_table]:[overflow-wrap:normal] [&_th]:border-b [&_th]:p-2 [&_th]:text-left [&_td]:border-b [&_td]:p-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:text-left [&_pre]:[overflow-wrap:normal]"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {post.tags?.length ? (
            <div className="mt-10 flex flex-wrap justify-center gap-2 sm:justify-start">
              {post.tags.map((t) => (
                <Badge key={t} variant="outline" className="max-w-full text-center [overflow-wrap:anywhere]">
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-12 rounded-2xl border border-border bg-soft p-6 text-center">
            <p className="font-display text-xl font-bold">Wondering what you'd actually qualify for?</p>
            <p className="mobile-body mt-2 text-sm text-muted-foreground">
              A short financing inquiry takes 2 minutes, is 100% free with no impact on your credit score.
            </p>
            <Button asChild className="mt-4 h-auto min-h-11 w-full max-w-full py-3 text-center sm:w-auto">
              <Link href="/apply">Check Financing Options</Link>
            </Button>
          </div>
        </div>

        {related.length > 0 && (
          <section className="border-t border-border bg-soft">
            <div className="container mx-auto max-w-5xl px-4 py-14 lg:px-8">
              <h2 className="mobile-heading mb-6 font-display text-xl font-bold">Keep reading</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                      <p className="mobile-heading font-semibold leading-snug group-hover:text-primary [overflow-wrap:anywhere]">{r.title}</p>
                      <p className="mobile-heading mt-1 text-xs text-muted-foreground">{r.reading_minutes} min read</p>
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
