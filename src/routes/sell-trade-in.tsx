import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { submitLead } from "@/lib/leads.functions";
import { getTracking } from "@/lib/attribution";

import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/sell-trade-in")({
  head: () => ({
    meta: [
      { title: "Sell or Trade-In Your Vehicle — Auto World Approvals" },
      { name: "description", content: "Get a fast, free estimate for your trade-in or sell your vehicle outright. Serving Western Canada drivers — no obligation." },
      { property: "og:title", content: "Value Your Trade-In | Auto World Approvals" },
      { property: "og:description", content: "Submit your vehicle details and we'll give you an estimate — fast, free, no obligation." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://autoworldapprovals.com/sell-trade-in" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Value Your Trade-In | Auto World Approvals" },
      { name: "twitter:description", content: "Submit your vehicle details for a fast, free trade-in estimate." },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/sell-trade-in" }],
  }),
  component: Page,
});

function Page() {
  const submit = useServerFn(submitLead);
  const [form, setForm] = useState({ year: "", make: "", model: "", mileage: "", first_name: "", last_name: "", email: "", phone: "", province: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upd = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await submit({ data: { data: {
        first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone, province: form.province,
        has_trade_in: "yes", trade_in_year: form.year, trade_in_make: form.make, trade_in_model: form.model, trade_in_mileage: form.mileage,
        consent_accuracy: true, consent_contact: true, consent_credit_check: false, consent_not_guarantee: true,
      }, source: "trade_in_form", tracking: { ...getTracking() } } });
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "Try again"); } finally { setBusy(false); }
  };

  return (
    <SiteLayout>
      <PageHero title="Sell or trade in your current vehicle." description="Send us a few details and a representative may follow up with an estimate." />
      <section className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold">How it works</h2>
          <ul className="mt-4 space-y-3 text-foreground/85">
            {["Submit your vehicle details","We review your trade-in and the market","A representative shares a working estimate","Apply it to a new vehicle or sell outright"].map((l) => (
              <li key={l} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--electric)]" />{l}</li>
            ))}
          </ul>
          <Button asChild variant="navy" size="lg" className="mt-6"><Link to="/apply">Apply with a trade-in</Link></Button>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:p-8">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h3 className="mt-3 text-xl font-bold">We got it!</h3>
              <p className="mt-2 text-muted-foreground">A representative may contact you shortly with an estimate.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <h3 className="text-xl font-bold">Tell us about your vehicle</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Year</Label><Input value={form.year} onChange={(e) => upd("year", e.target.value)} required /></div>
                <div><Label>Make</Label><Input value={form.make} onChange={(e) => upd("make", e.target.value)} required /></div>
                <div><Label>Model</Label><Input value={form.model} onChange={(e) => upd("model", e.target.value)} required /></div>
                <div><Label>Mileage (km)</Label><Input value={form.mileage} onChange={(e) => upd("mileage", e.target.value)} required /></div>
                <div><Label>First name</Label><NameInput value={form.first_name} onChange={(e) => upd("first_name", e.target.value)} required /></div>
                <div><Label>Last name</Label><NameInput value={form.last_name} onChange={(e) => upd("last_name", e.target.value)} required /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} required /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => upd("phone", e.target.value)} required /></div>
                <div className="sm:col-span-2"><Label>Province</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={form.province} onChange={(e) => upd("province", e.target.value)} required>
                    <option value="">Select</option><option value="BC">British Columbia</option><option value="AB">Alberta</option><option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>{busy ? "Sending..." : "Request estimate"}</Button>
              <p className="text-xs text-muted-foreground">By submitting, you agree to be contacted. This is not a formal offer.</p>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
