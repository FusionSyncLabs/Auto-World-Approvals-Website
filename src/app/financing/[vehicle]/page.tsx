import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "@/components/ui/link";

interface VehiclePage {
  vt: string;
  name: string;
  title: string;
  description: string;
  points: string[];
}

const PAGES: Record<string, VehiclePage> = {
  truck: {
    vt: "truck",
    name: "Truck",
    title: "Truck Financing for Western Canada",
    description:
      "From half-tons to heavy-duty work trucks, we match you with lenders who finance the truck you need — all credit situations considered.",
    points: [
      "New and used trucks — half-ton, three-quarter-ton and heavy-duty",
      "Work trucks and personal trucks both welcome",
      "All credit situations considered — bad credit, no credit, new to Canada",
      "Free to apply and no obligation",
    ],
  },
  suv: {
    vt: "suv",
    name: "SUV",
    title: "SUV & Crossover Financing for Western Canada",
    description:
      "Compact crossovers to full-size family SUVs — get pre-qualified for financing that fits your budget before you shop.",
    points: [
      "Compact, mid-size and full-size SUVs and crossovers",
      "Family-friendly payment options matched to your budget",
      "All credit situations considered — bad credit, no credit, new to Canada",
      "Free to apply and no obligation",
    ],
  },
  car: {
    vt: "car",
    name: "Car",
    title: "Car Financing for Western Canada",
    description:
      "Sedans, hatchbacks and coupes — affordable monthly payments on the car you actually want, with lenders who work with every credit situation.",
    points: [
      "Sedans, hatchbacks, coupes and wagons — new and used",
      "Budget-friendly options with payments you can plan around",
      "All credit situations considered — bad credit, no credit, new to Canada",
      "Free to apply and no obligation",
    ],
  },
  ev: {
    vt: "ev_hybrid",
    name: "Electric & Hybrid",
    title: "EV & Hybrid Financing for Western Canada",
    description:
      "Going electric or hybrid? We work with lenders who finance EVs and hybrids — including used models — across Western Canada.",
    points: [
      "Full electric, plug-in hybrid and hybrid models — new and used",
      "Lenders familiar with EV pricing and incentives",
      "All credit situations considered — bad credit, no credit, new to Canada",
      "Free to apply and no obligation",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((vehicle) => ({ vehicle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vehicle: string }>;
}): Promise<Metadata> {
  const { vehicle } = await params;
  const page = PAGES[vehicle];
  if (!page) return { title: "Financing — Auto World Approvals" };
  return {
    title: `${page.name} Financing — Auto World Approvals`,
    description: page.description,
  };
}

export default async function VehicleRoute({
  params,
}: {
  params: Promise<{ vehicle: string }>;
}) {
  const { vehicle } = await params;
  const page = PAGES[vehicle];
  if (!page) notFound();

  return (
    <SiteLayout>
      <PageHero
        title={page.title}
        description={page.description}
      />

      <section className="container mx-auto px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl flex flex-col items-center sm:items-start text-center sm:text-left">
          <h2 className="text-2xl font-bold">What you get</h2>
          <ul className="mt-6 space-y-4 text-left inline-block">
            {page.points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--electric)]" />
                <span className="text-base">{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8 text-center shadow-card w-full">
            <h3 className="text-xl font-bold">Check your financing options</h3>
            <p className="mt-2 text-muted-foreground">
              Answer a few quick questions and a financing specialist will follow
              up with your options.
            </p>
            <Link
              href={`/apply?vt=${page.vt}`}
              className="mt-6 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[var(--electric)] px-8 py-3 text-base font-semibold text-white hover:opacity-90"
            >
              Start my {page.name.toLowerCase()} application{" "}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Free to apply · No obligation
            </p>
          </div>

          <p className="mt-8 text-sm text-muted-foreground text-center sm:text-left">
            Serving British Columbia, Alberta, Saskatchewan, Manitoba, Yukon,
            the Northwest Territories and Nunavut. Submitting an inquiry is not
            an approval; any financing decision is made by the lender.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
