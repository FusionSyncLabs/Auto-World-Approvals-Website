import type { Metadata } from "next";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

export const metadata: Metadata = {
  title: "How It Works — Auto World Approvals",
  description:
    "Four simple steps from online pre-qualification to driveway. See exactly how Auto World Approvals helps Western Canada drivers explore vehicle financing.",
};

const steps = [
  {
    n: "01",
    t: "Choose your vehicle type",
    b: "Tell us what you're shopping for — car, SUV, truck, EV, or work vehicle. This focuses your matches.",
  },
  {
    n: "02",
    t: "Complete the secure application",
    b: "Quick questions about budget, income, and trade-in. We never ask for your SIN.",
  },
  {
    n: "03",
    t: "Get matched with options",
    b: "We share your application with our trusted dealer-finance network across Western Canada.",
  },
  {
    n: "04",
    t: "Drive away",
    b: "Pick the option that fits your budget, sign with the dealer, and hit the road.",
  },
];

export default function HowItWorksPage() {
  return (
    <SiteLayout>
      <PageHero
        title="Four simple steps from application to driveway."
        description="Fast, secure, and honest pre-qualification for drivers in Western Canada."
      />
      <section className="container mx-auto px-4 py-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-card flex flex-col items-center text-center sm:items-start sm:text-left"
            >
              <p className="font-display text-3xl sm:text-4xl font-bold text-[var(--electric)]">
                {s.n}
              </p>
              <h3 className="mt-2 text-lg sm:text-xl font-semibold">{s.t}</h3>
              <p className="mobile-body mt-2 w-full text-sm sm:text-base text-muted-foreground">{s.b}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 sm:mt-12 text-center">
          <Button asChild variant="hero" size="xl" className="w-full sm:w-auto">
            <Link href="/apply">Check Financing Options</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
