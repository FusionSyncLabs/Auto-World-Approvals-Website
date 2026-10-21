import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";
import { Car, Truck, Battery, Wrench, Star } from "lucide-react";

export const Route = createFileRoute("/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehicle Types — Cars, Trucks, SUVs & EVs | Auto World Approvals" },
      { name: "description", content: "Browse cars, SUVs, trucks, EVs and work vehicles for financing inquiries across Western Canada." },
      { property: "og:title", content: "Vehicle Types | Auto World Approvals" },
      { property: "og:description", content: "Browse the vehicle types we help finance across Western Canada — cars, trucks, SUVs, EVs and more." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://autoworldapprovals.com/vehicles" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Vehicle Types | Auto World Approvals" },
      { name: "twitter:description", content: "Cars, trucks, SUVs, EVs and more — financing inquiries across Western Canada." },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/vehicles" }],
  }),
  component: Page,
});

const types = [
  { icon: Car, vt: "car", t: "Cars & Sedans", b: "Reliable daily drivers — coupes, sedans, hatchbacks." },
  { icon: Car, vt: "suv", t: "SUVs & Crossovers", b: "Family-friendly, all-weather, and plenty of cargo space." },
  { icon: Truck, vt: "truck", t: "Trucks", b: "Half-tons to heavy-duty for work and play." },
  { icon: Car, vt: "van", t: "Minivans", b: "Smart family hauling without the SUV price tag." },
  { icon: Truck, vt: "van", t: "Vans", b: "Cargo and passenger vans for business or adventure." },
  { icon: Battery, vt: "ev_hybrid", t: "Electric & Hybrid", b: "EVs, plug-in hybrids and hybrids from major brands." },
  { icon: Star, vt: "car", t: "Luxury", b: "Premium European and Japanese marques." },
  { icon: Wrench, vt: "truck", t: "Work Vehicles", b: "Trades, fleet, and contractor-ready trucks and vans." },
];

function Page() {
  return (
    <SiteLayout>
      <PageHero title="Financing for every kind of vehicle." description="Tell us what you're after and we'll match you with options from our dealer-finance network." />
      <section className="container mx-auto grid gap-5 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {types.map((v) => (
          <Link key={v.t} to="/apply" search={{ vt: v.vt }} className="group rounded-2xl border border-border bg-card p-6 shadow-card transition hover:-translate-y-1 hover:border-[var(--electric)] hover:shadow-elevated">
            <v.icon className="h-8 w-8 text-[var(--navy)] transition group-hover:text-[var(--electric)]" />
            <h3 className="mt-4 font-semibold">{v.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{v.b}</p>
          </Link>
        ))}
      </section>
      <section className="bg-soft py-12">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-center lg:px-8">
          <h2 className="text-2xl font-bold lg:text-3xl">Not sure which type fits?</h2>
          <p className="max-w-xl text-muted-foreground">Start the application and we'll help you sort it out along the way.</p>
          <Button asChild variant="hero" size="lg"><Link to="/apply">Check Financing Options</Link></Button>
        </div>
      </section>
    </SiteLayout>
  );
}
