"use client";

import { useState, useEffect } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { executeRecaptcha, loadRecaptchaScript } from "@/lib/recaptcha";
import { trackGa } from "@/lib/analytics";
import { toast } from "sonner";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    if (siteKey && siteKey !== "your_recaptcha_site_key_here") {
      loadRecaptchaScript(siteKey).catch((e) => console.error("[recaptcha]", e));
    }
  }, [siteKey]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Execute reCAPTCHA v3 invisible check
      const recaptchaToken = await executeRecaptcha("contact_form");

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, recaptchaToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not send your message.");
      }
      setSent(true);
      trackGa("contact_submit");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteLayout>
      <PageHero
        title="Get in touch."
        description="Questions about your application? We're here to help."
      />
      <section className="container mx-auto grid grid-cols-1 gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left rounded-xl border border-border bg-card p-5 shadow-card">
            <Mail className="h-5 w-5 text-[var(--electric)]" />
            <p className="mt-2 font-semibold">Email</p>
            <a
              href="mailto:admin@autoworldapprovals.com"
              className="inline-block min-h-11 max-w-full py-2 text-sm text-muted-foreground underline [overflow-wrap:anywhere]"
            >
              admin@autoworldapprovals.com
            </a>
          </div>
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left rounded-xl border border-border bg-card p-5 shadow-card">
            <MapPin className="h-5 w-5 text-[var(--electric)]" />
            <p className="mt-2 font-semibold">Service area</p>
            <p className="text-sm text-muted-foreground">
              British Columbia &amp; Alberta
            </p>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-card lg:p-8">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h3 className="mt-3 text-xl font-bold">Thanks! Message sent.</h3>
              <p className="mt-2 text-muted-foreground">
                We&apos;ll get back to you shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="min-w-0 space-y-4">
              <h3 className="text-xl font-bold text-center sm:text-left">Send us a message</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-4">
                <div className="min-w-0">
                  <Label htmlFor="contact-name">Name</Label>
                  <NameInput
                    id="contact-name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input
                    id="contact-email"
                    autoComplete="email"
                    required
                    type="email"
                    maxLength={255}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  required
                  rows={5}
                  maxLength={5000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="h-auto min-h-12 w-full px-4 py-3"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send message"
                )}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground/80 leading-normal">
                This site is protected by reCAPTCHA and the Google{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a
                  href="https://policies.google.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Terms of Service
                </a>{" "}
                apply.
              </p>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
