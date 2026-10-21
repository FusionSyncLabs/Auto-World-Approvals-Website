import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/link";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight } from "lucide-react";

interface RegionPage {
  name: string;
  title: string;
  description: string;
  sections: { h: string; p: string }[];
}

const REGIONS: Record<string, RegionPage> = {
  bc: {
    name: "British Columbia",
    title: "Vehicle financing in British Columbia",
    description:
      "A plain-English guide to financing a car, truck, SUV or EV in BC, and how an Auto World Approvals inquiry works.",
    sections: [
      {
        h: "How financing a vehicle in BC usually works",
        p: "Most buyers finance through a dealership, which submits the application to one or more lenders. The lender decides whether to approve the loan and sets the rate and term. Auto World Approvals helps you start that process: you send a short inquiry, an advisor contacts you, and your inquiry can be shared with suitable dealer-finance partners.",
      },
      {
        h: "Costs to plan for in BC",
        p: "Beyond the monthly payment, budget for taxes on the purchase, ICBC insurance, registration, fuel or charging, and maintenance. A down payment or trade-in can lower the amount financed, but neither is required to send an inquiry.",
      },
      {
        h: "Buying an EV in BC",
        p: "Electric and hybrid vehicles are popular in BC. Available incentives change over time, so confirm current federal and provincial programs and eligibility with the dealer before you rely on them.",
      },
      {
        h: "What to have ready when an advisor calls",
        p: "Your preferred vehicle type, a comfortable monthly budget, and a general idea of your income source and how long you have been there. You will not be asked for your SIN, banking passwords or documents in the online inquiry.",
      },
    ],
  },
  alberta: {
    name: "Alberta",
    title: "Vehicle financing in Alberta",
    description:
      "A plain-English guide to financing a car, truck, SUV or EV in Alberta, and how an Auto World Approvals inquiry works.",
    sections: [
      {
        h: "How financing a vehicle in Alberta usually works",
        p: "Dealerships typically submit financing applications to lenders, who make the lending decision and set the rate and term. Your Auto World Approvals inquiry starts the conversation: an advisor contacts you and your inquiry can be shared with suitable dealer-finance partners.",
      },
      {
        h: "Costs to plan for in Alberta",
        p: "Alberta has no provincial sales tax, but GST still applies to vehicle purchases. Also plan for insurance, registration through a registry agent, fuel and maintenance. Trucks and SUVs often cost more to insure and fuel.",
      },
      {
        h: "Trucks and work vehicles",
        p: "Many Alberta buyers finance trucks for work and towing. Tell your advisor how you plan to use the vehicle so the options discussed fit your needs and budget.",
      },
      {
        h: "What to have ready when an advisor calls",
        p: "Your preferred vehicle type, a comfortable monthly budget, and a general idea of your income source. You will not be asked for your SIN, banking passwords or documents in the online inquiry.",
      },
    ],
  },
};

interface Props {
  params: Promise<{ region: string }>;
}

export function generateStaticParams() {
  return Object.keys(REGIONS).map((region) => ({ region }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  const r = REGIONS[region.toLowerCase()];
  if (!r) return { title: "Vehicle Financing | Auto World Approvals" };

  return {
    title: `${r.title} — Auto World Approvals`,
    description: r.description,
    openGraph: {
      title: r.title,
      description: r.description,
      type: "article",
      url: `https://www.autoworldapprovals.com/vehicle-financing/${region}`,
    },
    twitter: {
      card: "summary",
      title: r.title,
      description: r.description,
    },
  };
}

export default async function RegionPageView({ params }: Props) {
  const { region } = await params;
  const r = REGIONS[region.toLowerCase()];
  if (!r) notFound();

  return (
    <SiteLayout>
      <PageHero title={r.title} description={r.description} />
      <section className="container mx-auto max-w-4xl px-4 py-12 lg:px-8 lg:py-16">
        <div>
          <Accordion type="single" collapsible defaultValue="item-0" className="space-y-3">
            {r.sections.map((s, i) => (
              <AccordionItem
                key={s.h}
                value={`item-${i}`}
                className="rounded-2xl border border-border bg-card px-6 shadow-card transition-colors hover:border-[var(--electric)]/40"
              >
                <AccordionTrigger className="text-left text-base sm:text-lg font-semibold hover:no-underline hover:text-[var(--electric)] py-5">
                  <span className="mobile-heading min-w-0 flex-1 pl-4 sm:pl-0">{s.h}</span>
                </AccordionTrigger>
                <AccordionContent className="mobile-body text-base text-foreground/80 leading-relaxed pt-1 pb-5">
                  {s.p}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 rounded-2xl border border-border bg-card p-8 sm:p-10 text-center shadow-card">
            <h3 className="font-display text-2xl font-bold tracking-tight">Ready to explore your options?</h3>
            <p className="mobile-body mt-2 text-muted-foreground">A short inquiry, then an advisor contacts you about next steps.</p>
            <Button asChild variant="hero" size="xl" className="mt-6 shadow-glow">
              <Link href="/apply">
                Check Financing Options <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Free · No obligation · An inquiry is not an approval; lenders make all financing decisions.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
