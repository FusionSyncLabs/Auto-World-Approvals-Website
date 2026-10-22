"use client";

import { useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { getTracking } from "@/lib/attribution";
import { CheckCircle2 } from "lucide-react";

export default function SellTradeInPage() {
  const [form, setForm] = useState({
    year: "",
    make: "",
    model: "",
    mileage: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    province: "",
  });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upd = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          answers: {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            phone: form.phone,
            province: form.province,
            has_trade_in: "yes",
            trade_in_year: form.year,
            trade_in_make: form.make,
            trade_in_model: form.model,
            trade_in_mileage: form.mileage,
          },
          consents: {
            consent_accuracy: true,
            consent_contact: true,
            consent_not_guarantee: true,
            consent_marketing: false,
          },
          tracking: getTracking(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Submission failed");
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteLayout>
      <PageHero
        title="Sell or trade in your current vehicle."
        description="Send us a few details and a representative may follow up with an estimate."
      />
      <section className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8">
        <div className="min-w-0 text-center lg:text-left flex flex-col items-center lg:items-start">
          <h2 className="text-2xl font-bold">How it works</h2>
          <ul className="mt-4 space-y-3 text-foreground/85 text-left inline-block">
            {[
              "Submit your vehicle details",
              "We review your trade-in and the market",
              "A representative shares a working estimate",
              "Apply it to a new vehicle or sell outright",
            ].map((l) => (
              <li key={l} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--electric)]" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{l}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="navy" size="lg" className="mt-6 h-auto min-h-12 w-full max-w-full px-4 py-3 sm:w-auto">
            <Link href="/apply">Apply with a trade-in</Link>
          </Button>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6 lg:p-8">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h3 className="mt-3 text-xl font-bold">We got it!</h3>
              <p className="mobile-body mt-2 text-muted-foreground">
                A representative may contact you shortly with an estimate.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="min-w-0 space-y-4">
              <h3 className="text-xl font-bold text-center sm:text-left">Tell us about your vehicle</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-4 [&>div]:min-w-0">
                <div>
                  <Label htmlFor="trade-year">Year</Label>
                  <Input
                    id="trade-year"
                    value={form.year}
                    onChange={(e) => upd("year", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trade-make">Make</Label>
                  <Input
                    id="trade-make"
                    value={form.make}
                    onChange={(e) => upd("make", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trade-model">Model</Label>
                  <Input
                    id="trade-model"
                    value={form.model}
                    onChange={(e) => upd("model", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trade-mileage">Mileage (km)</Label>
                  <Input
                    id="trade-mileage"
                    value={form.mileage}
                    onChange={(e) => upd("mileage", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trade-first-name">First name</Label>
                  <NameInput
                    id="trade-first-name"
                    value={form.first_name}
                    onChange={(e) => upd("first_name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trade-last-name">Last name</Label>
                  <NameInput
                    id="trade-last-name"
                    value={form.last_name}
                    onChange={(e) => upd("last_name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trade-email">Email</Label>
                  <Input
                    id="trade-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => upd("email", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trade-phone">Phone</Label>
                  <Input
                    id="trade-phone"
                    value={form.phone}
                    onChange={(e) => upd("phone", e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-full">
                  <Label htmlFor="trade-province">Province</Label>
                  <select
                    id="trade-province"
                    className="h-11 min-w-0 w-full rounded-md border border-input bg-background px-3 text-base"
                    value={form.province}
                    onChange={(e) => upd("province", e.target.value)}
                    required
                  >
                    <option value="">Select</option>
                    <option value="BC">British Columbia</option>
                    <option value="AB">Alberta</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              {err && <p role="alert" className="text-sm text-destructive [overflow-wrap:anywhere]">{err}</p>}
              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="h-auto min-h-12 w-full px-4 py-3"
                disabled={busy}
              >
                {busy ? "Sending..." : "Request estimate"}
              </Button>
              <p className="mobile-body text-xs text-muted-foreground">
                By submitting, you agree to be contacted. This is not a formal
                offer.
              </p>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
