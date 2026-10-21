import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Mail, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings/")({
  head: () => ({ meta: [{"title": "Settings | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals settings area for authorized users."}, {"property": "og:title", "content": "Settings | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals settings area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key, value");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyOnNewLead, setNotifyOnNewLead] = useState(true);
  const [notifyMinScore, setNotifyMinScore] = useState<number>(0);
  const [faviconUrl, setFaviconUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    if (!data) return;
    const m = Object.fromEntries(data.map((s) => [s.key, s.value]));
    if (Array.isArray(m.lead_notification_emails)) setEmails(m.lead_notification_emails as string[]);
    if (typeof m.from_email === "string") setFromEmail(m.from_email);
    if (typeof m.contact_phone === "string") setPhone(m.contact_phone);
    if (typeof m.notify_on_new_lead === "boolean") setNotifyOnNewLead(m.notify_on_new_lead);
    if (typeof m.notify_min_score === "number") setNotifyMinScore(m.notify_min_score);
    if (typeof m.favicon_url === "string") setFaviconUrl(m.favicon_url);
    if (typeof m.logo_url === "string") setLogoUrl(m.logo_url);
  }, [data]);

  const fileToDataUrl = (file: File, maxBytes = 500_000) =>
    new Promise<string>((resolve, reject) => {
      if (file.size > maxBytes) return reject(new Error(`File too large (max ${Math.round(maxBytes / 1024)}KB)`));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });


  const addEmail = () => {
    const e = newEmail.trim().toLowerCase();
    if (!e.includes("@")) { toast.error("Enter a valid email"); return; }
    if (emails.includes(e)) { toast.error("Already added"); return; }
    setEmails([...emails, e]);
    setNewEmail("");
  };
  const removeEmail = (e: string) => setEmails(emails.filter((x) => x !== e));

  const save = async () => {
    const rows: { key: string; value: unknown }[] = [
      { key: "lead_notification_emails", value: emails },
      { key: "from_email", value: fromEmail || "Auto World Approvals <onboarding@resend.dev>" },
      { key: "contact_phone", value: phone },
      { key: "notify_on_new_lead", value: notifyOnNewLead },
      { key: "notify_min_score", value: Number(notifyMinScore) || 0 },
      { key: "favicon_url", value: faviconUrl },
      { key: "logo_url", value: logoUrl },
    ];
    try {
      for (const r of rows) {
        const { error } = await supabase.from("app_settings").upsert(r as never);
        if (error) throw error;
      }
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      qc.invalidateQueries({ queryKey: ["branding"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure lead alerts, sender details, and contact info.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-[var(--electric)]" /><h2 className="font-semibold">Lead alert recipients</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Add every email that should receive new-lead alerts.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {emails.length === 0 && <p className="text-xs italic text-muted-foreground">No recipients yet — add one below.</p>}
            {emails.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[var(--electric)]/10 px-3 py-1 text-sm text-[var(--navy)]">
                {e}
                <button onClick={() => removeEmail(e)} className="ml-1 rounded-full p-0.5 hover:bg-black/10"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
              placeholder="name@dealer.com"
              type="email"
            />
            <Button variant="outline" onClick={addEmail}><Plus className="h-4 w-4" /> Add</Button>
          </div>

          <div className="mt-6 space-y-4 border-t border-border pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notifyOnNewLead} onChange={(e) => setNotifyOnNewLead(e.target.checked)} className="h-4 w-4 rounded border-border" />
              Send an alert for every new lead
            </label>
            <div>
              <Label>Minimum lead score to trigger alert</Label>
              <Input type="number" min={0} max={100} value={notifyMinScore} onChange={(e) => setNotifyMinScore(Number(e.target.value))} disabled={!notifyOnNewLead} />
              <p className="mt-1 text-xs text-muted-foreground">Only leads scoring at or above this value trigger alerts. Use 0 for all leads.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-semibold">Sender & branding</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label>From address</Label>
                <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="Auto World Approvals <leads@autoworldapprovals.com>" disabled={isLoading} />
                <p className="mt-1 text-xs text-muted-foreground">Visible name and address on outbound alerts.</p>
              </div>
              <div>
                <Label>Contact phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="1-800-555-0199" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-50/40 p-5 text-sm">
            <p className="font-semibold">Email delivery</p>
            <p className="mt-1 text-muted-foreground">
              Lead alerts use the configured email provider. To enable outbound email, set up your email domain in Lovable Cloud → Emails,
              or add a <code className="rounded bg-card px-1.5 py-0.5">RESEND_API_KEY</code> in project secrets. Leads are always saved, even
              if email delivery is unavailable.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-[var(--electric)]" /><h2 className="font-semibold">Branding</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Upload a custom favicon (browser tab icon) and site logo. Recommended: square PNG/SVG under 500KB.</p>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <Label>Favicon</Label>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-background">
                {faviconUrl ? <img src={faviconUrl} alt="Favicon preview" className="h-10 w-10 object-contain" /> : <span className="text-xs text-muted-foreground">None</span>}
              </div>
              <Input
                type="file"
                accept="image/png,image/svg+xml,image/x-icon,image/jpeg,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try { setFaviconUrl(await fileToDataUrl(f)); } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
                }}
              />
              {faviconUrl && <Button variant="outline" size="sm" onClick={() => setFaviconUrl("")}>Clear</Button>}
            </div>
          </div>

          <div>
            <Label>Logo</Label>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-background">
                {logoUrl ? <img src={logoUrl} alt="Logo preview" className="h-10 w-10 object-contain" /> : <span className="text-xs text-muted-foreground">None</span>}
              </div>
              <Input
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try { setLogoUrl(await fileToDataUrl(f)); } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
                }}
              />
              {logoUrl && <Button variant="outline" size="sm" onClick={() => setLogoUrl("")}>Clear</Button>}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Click "Save changes" below to apply.</p>
      </div>


      <div className="mt-6 flex items-center gap-3">
        <Button variant="hero" size="lg" onClick={save}>Save changes</Button>
      </div>
    </AdminLayout>
  );
}
