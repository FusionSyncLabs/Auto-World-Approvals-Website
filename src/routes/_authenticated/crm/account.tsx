import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCrmSession } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/crm/account")({
  head: () => ({ meta: [{"title": "My Account \u2014 Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals my account area for authorized users."}, {"property": "og:title", "content": "My Account \u2014 Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals my account area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: AccountPage,
});

function AccountPage() {
  const sessionFn = useServerFn(getCrmSession);
  const { data: session } = useQuery({ queryKey: ["crm-session"], queryFn: () => sessionFn() });
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const change = async () => {
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw(""); setConfirm("");
    toast.success("Password updated");
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">My account</h1>
        <p className="text-sm text-muted-foreground">Manage your portal login.</p>
      </div>

      <div className="space-y-1 rounded-xl border border-border bg-card p-4 text-sm">
        <p><span className="text-muted-foreground">Name:</span> <strong>{session?.full_name ?? "—"}</strong></p>
        <p><span className="text-muted-foreground">Email:</span> <strong>{session?.email ?? "—"}</strong></p>
        <p><span className="text-muted-foreground">Role:</span> <strong className="capitalize">{session?.role ?? "—"}</strong></p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold">Change password</h2>
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf">Confirm password</Label>
          <Input id="cf" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button onClick={change} disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
      </div>
    </div>
  );
}
