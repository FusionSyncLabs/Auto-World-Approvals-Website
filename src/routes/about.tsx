import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Award, MapPin, Lock, Heart } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Auto World Approvals" },
      { name: "description", content: "Auto World Approvals helps drivers in Western Canada find vehicle financing options that fit — modern, transparent, all credit considered." },
      { property: "og:title", content: "About Auto World Approvals" },
      { property: "og:description", content: "A modern Canadian vehicle financing service for Western Canada." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://autoworldapprovals.com/about" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "About Auto World Approvals" },
      { name: "twitter:description", content: "A modern Canadian vehicle financing service for Western Canada." },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/about" }],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero title="Vehicle financing built around drivers in Western Canada." description="We connect buyers with dealer-finance options in Western Canada — without the pressure or jargon." />
      <section className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold">Our mission</h2>
          <p className="mt-4 text-foreground/85">
            Buying a vehicle should feel straightforward. We built Auto World Approvals to give Western Canadian drivers a simple,
            honest way to see financing options before they walk into a dealership. No surprise calls. No obligation. Just clear next steps.
          </p>
          <p className="mt-4 text-foreground/85">
            We work with a vetted network of dealer-finance partners across British Columbia and Alberta, so you can compare options
            on your own time — and only move forward when you're ready.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { i: Award, t: "Honest", b: "We don't promise guaranteed approval. We do promise a real, no-pressure conversation." },
            { i: MapPin, t: "Western Canada-focused", b: "We know Western Canada dealerships, lenders, and the people who buy from them." },
            { i: Lock, t: "Secure", b: "Your data is encrypted in transit and we never store sensitive documents." },
            { i: Heart, t: "Driver-first", b: "Built for the people in the driver's seat — not just the dealership floor." },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <c.i className="h-6 w-6 text-[var(--electric)]" />
              <p className="mt-3 font-semibold">{c.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.b}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
