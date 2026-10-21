import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — Auto World Approvals" },
      { name: "description", content: "Four simple steps from online pre-qualification to driveway. See exactly how Auto World Approvals helps Western Canada drivers explore vehicle financing." },
      { property: "og:title", content: "How Auto World Approvals Works" },
      { property: "og:description", content: "Complete a short online inquiry and an advisor will contact you about vehicle financing options in Western Canada." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://autoworldapprovals.com/how-it-works" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "How Auto World Approvals Works" },
      { name: "twitter:description", content: "Complete a short online inquiry about vehicle financing in Western Canada." },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/how-it-works" }],
  }),
  component: Page,
});

const steps = [
  { n: "01", t: "Choose your vehicle type", b: "Tell us what you're shopping for — car, SUV, truck, EV, or work vehicle. This focuses your matches." },
  { n: "02", t: "Complete the secure application", b: "Quick questions about budget, income, and trade-in. We never ask for your SIN." },
  { n: "03", t: "Get matched with options", b: "We share your application with our trusted dealer-finance network across Western Canada." },
  { n: "04", t: "Drive away", b: "Pick the option that fits your budget, sign with the dealer, and hit the road." },
];

function Page() {
  return (
    <SiteLayout>
      <PageHero title="Four simple steps from application to driveway." description="Fast, secure, and honest pre-qualification for drivers in Western Canada." />
      <section className="container mx-auto px-4 py-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-card p-8 shadow-card">
              <p className="font-display text-4xl font-bold text-[var(--electric)]">{s.n}</p>
              <h3 className="mt-2 text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-muted-foreground">{s.b}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Button asChild variant="hero" size="xl"><Link to="/apply">Check Financing Options</Link></Button>
        </div>
      </section>
    </SiteLayout>
  );
}
