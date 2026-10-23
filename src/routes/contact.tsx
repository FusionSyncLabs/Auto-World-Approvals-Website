import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { TurnstileWidget } from "@/components/site/TurnstileWidget";
import { submitContactMessage } from "@/lib/contact.functions";
import { trackGa } from "@/lib/analytics";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Auto World Approvals" },
      { name: "description", content: "Get in touch with the Auto World Approvals team for help with your vehicle financing application in Western Canada." },
      { property: "og:title", content: "Contact Auto World Approvals" },
      { property: "og:description", content: "Reach the Auto World Approvals team serving Western Canada drivers." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://autoworldapprovals.com/contact" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Contact Auto World Approvals" },
      { name: "twitter:description", content: "Reach the Auto World Approvals team serving Western Canada drivers." },
    ],
    links: [{ rel: "canonical", href: "https://autoworldapprovals.com/contact" }],
  }),
  component: Page,
});

function formatPhoneInput(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function Page() {
  const submit = useServerFn(submitContactMessage);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  const hasTurnstile = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

  const onToken = useCallback((t: string) => setTurnstileToken(t), []);
  const onExpire = useCallback(() => setTurnstileToken(""), []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasTurnstile && !turnstileToken) {
      toast.error("Please complete the captcha first.");
      return;
    }
    setBusy(true);
    try {
      await submit({ data: { name, email, phone, message, turnstileToken } });
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
      <PageHero title="Get in touch." description="Questions about your application? We're here to help." />
      <section className="container mx-auto grid grid-cols-1 gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8">
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card"><Mail className="h-5 w-5 text-[var(--electric)]" /><p className="mt-2 font-semibold">Email</p><a href="mailto:admin@autoworldapprovals.com" className="break-words text-sm text-muted-foreground underline">admin@autoworldapprovals.com</a></div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card"><MapPin className="h-5 w-5 text-[var(--electric)]" /><p className="mt-2 font-semibold">Service area</p><p className="text-sm text-muted-foreground">British Columbia &amp; Alberta</p></div>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-card lg:p-8">
          {sent ? (
            <div className="text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-success" /><h3 className="mt-3 text-xl font-bold">Thanks! Message sent.</h3><p className="mt-2 text-muted-foreground">We'll get back to you shortly.</p></div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <h3 className="text-xl font-bold">Send us a message</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label htmlFor="contact-name">Name</Label><NameInput id="contact-name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label htmlFor="contact-email">Email</Label><Input id="contact-email" autoComplete="email" required type="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="contact-phone">Phone number</Label><Input id="contact-phone" autoComplete="tel" required type="tel" maxLength={16} placeholder="(604) 555-0123" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} /></div>
              </div>
              <div><Label htmlFor="contact-message">Message</Label><Textarea id="contact-message" required rows={5} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
              <TurnstileWidget onToken={onToken} onExpire={onExpire} />
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy || (hasTurnstile && !turnstileToken)}>
                {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : "Send message"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
