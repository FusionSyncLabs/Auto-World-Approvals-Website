import { Metadata } from "next";
import Link from "@/components/ui/link";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { fetchPublishedPosts } from "@/lib/blog-data";

export const metadata: Metadata = {
  title: "Car Buying & Auto Financing Guides | Auto World Approvals",
  description:
    "Practical guides on buying a car, auto loans, credit, trade-ins and ownership costs in British Columbia and Alberta — written for Canadian drivers.",
  openGraph: {
    type: "website",
    title: "Car Buying & Auto Financing Guides",
    description: "Straightforward advice on car loans, credit, trade-ins and ownership costs in Western Canada.",
    url: "https://autoworldapprovals.com/blog",
  },
  alternates: {
    canonical: "https://autoworldapprovals.com/blog",
  },
};

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export default async function BlogIndexPage() {
  const posts = await fetchPublishedPosts();
  const [featured, ...rest] = posts;

  return (
    <SiteLayout>
      <PageHero
        title="Guides for Canadian car buyers"
        description="Straight answers on financing, credit, trade-ins and the real cost of owning a vehicle in Western Canada."
      />

      <section className="container mx-auto px-4 py-14 lg:px-8 lg:py-20">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <h2 className="font-display text-xl font-bold">New guides are on the way</h2>
            <p className="mt-2 text-muted-foreground">
              Our team is drafting practical advice on credit rebuilding, auto loan rates, and vehicle buying in BC & Alberta. Check back soon.
            </p>
            <div className="mt-6">
              <Link
                href="/apply"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                Apply for Financing
              </Link>
            </div>
          </div>
        ) : (
          <>
            {featured && (
              <Link
                href={`/blog/${featured.slug}`}
                className="group mb-12 grid gap-6 overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50 lg:grid-cols-2"
              >
                {featured.cover_image_url && (
                  <img
                    src={featured.cover_image_url}
                    alt={featured.cover_alt ?? featured.title}
                    className="h-64 w-full object-cover lg:h-full"
                    loading="eager"
                  />
                )}
                <div className="flex flex-col justify-center p-6 lg:p-10">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {featured.category && <Badge variant="secondary">{featured.category}</Badge>}
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {featured.reading_minutes} min read
                    </span>
                  </div>
                  <h2 className="font-display text-2xl font-bold leading-tight group-hover:text-primary lg:text-3xl">
                    {featured.title}
                  </h2>
                  {featured.excerpt && <p className="mt-3 text-muted-foreground">{featured.excerpt}</p>}
                  <p className="mt-4 text-xs text-muted-foreground">{fmtDate(featured.published_at)}</p>
                </div>
              </Link>
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
                >
                  {p.cover_image_url && (
                    <img
                      src={p.cover_image_url}
                      alt={p.cover_alt ?? p.title}
                      className="h-44 w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {p.category && <Badge variant="secondary">{p.category}</Badge>}
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {p.reading_minutes} min
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold leading-snug group-hover:text-primary">
                      {p.title}
                    </h3>
                    {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>}
                    <p className="mt-4 text-xs text-muted-foreground">{fmtDate(p.published_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
