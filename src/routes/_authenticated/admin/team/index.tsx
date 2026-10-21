import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, UserPlus, Shield, KeyRound } from "lucide-react";
import { listAdmins, inviteAdmin, removeAdmin, createPortalUser, setPortalUserPassword } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/team/")({
  head: () => ({ meta: [{"title": "Team | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals team area for authorized users."}, {"property": "og:title", "content": "Team | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals team area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: TeamPage,
});

const ROLE_DESCRIPTIONS: Record<string, string> = {
  superadmin: "Full access including team & billing",
  admin: "Manage leads, settings, and team",
  agent: "Manage and follow-up on leads",
  viewer: "Read-only access to dashboard",
};

type TeamMember = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function TeamPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdmins);
  const inviteFn = useServerFn(inviteAdmin);
  const removeFn = useServerFn(removeAdmin);
  const createFn = useServerFn(createPortalUser);
  const setPwFn = useServerFn(setPortalUserPassword);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"superadmin" | "admin" | "agent" | "viewer">("admin");
  const [busy, setBusy] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [pEmail, setPEmail] = useState("");
  const [pName, setPName] = useState("");
  const [pPassword, setPPassword] = useState(randomPassword());
  const [pRole, setPRole] = useState<"agent" | "admin" | "viewer">("agent");

  const handleCreatePortalUser = async () => {
    setBusy(true);
    try {
      await createFn({ data: { email: pEmail.trim().toLowerCase(), password: pPassword, full_name: pName, role: pRole } });
      toast.success(`Login created for ${pEmail}`);
      setPortalOpen(false);
      setPEmail(""); setPName(""); setPPassword(randomPassword());
      qc.invalidateQueries({ queryKey: ["admin-team"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create login");
    } finally { setBusy(false); }
  };

  const handleResetPassword = async (userId: string, label: string) => {
    const next = prompt(`New password for ${label} (min 8 characters):`, randomPassword());
    if (!next) return;
    try {
      await setPwFn({ data: { user_id: userId, password: next } });
      toast.success("Password updated — share it securely with the user.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set password");
    }
  };

  const { data, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["admin-team"],
    queryFn: () => listFn(),
  });

  const handleInvite = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await inviteFn({ data: { email: email.trim().toLowerCase(), role } });
      toast.success(`Invited ${email} as ${role}`);
      setEmail(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-team"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally { setBusy(false); }
  };

  const handleRemove = async (id: string, label: string) => {
    if (!confirm(`Revoke role for ${label}?`)) return;
    try {
      await removeFn({ data: { id } });
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["admin-team"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team & Roles</h1>
          <p className="text-sm text-muted-foreground">Invite admins, agents, and viewers to access the dashboard.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setPPassword(randomPassword()); setPortalOpen(true); }}>
            <KeyRound className="h-4 w-4" /> Create CRM login
          </Button>
          <Button variant="hero" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Invite member</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {isLoading && <p className="p-8 text-center text-muted-foreground">Loading…</p>}
        {!isLoading && (!data || data.length === 0) && (
          <div className="p-10 text-center">
            <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No team members yet</p>
            <p className="text-sm text-muted-foreground">Invite your first admin to get started.</p>
          </div>
        )}
        {data && data.length > 0 && (
          <ul className="divide-y divide-border">
            {data.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.full_name || m.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--navy)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">{m.role}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleResetPassword(m.user_id, m.email)} title="Set password">
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id, m.email)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite a team member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@dealer.com" />
            </div>
            <div>
              <Label>Role</Label>
              <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {(["admin","agent","viewer","superadmin"] as const).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
            <p className="rounded-md bg-secondary p-2 text-xs text-muted-foreground">
              If this person doesn't have an account yet, they'll receive an email invitation to set a password.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleInvite} disabled={busy}>{busy ? "Inviting…" : "Send invite"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={portalOpen} onOpenChange={setPortalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create a CRM portal login</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full name</Label>
              <NameInput value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Jordan Smith" />
            </div>
            <div>
              <Label>Username or email</Label>
              <Input value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder="jordan  or  jordan@dealer.com" />
              <p className="mt-1 text-xs text-muted-foreground">A plain username works — no email required. They sign in with it at /auth.</p>
            </div>

            <div>
              <Label>Temporary password</Label>
              <div className="flex gap-2">
                <Input value={pPassword} onChange={(e) => setPPassword(e.target.value)} />
                <Button type="button" variant="outline" onClick={() => setPPassword(randomPassword())}>New</Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">The user can change this from My account in the CRM.</p>
            </div>
            <div>
              <Label>Access level</Label>
              <select value={pRole} onChange={(e) => setPRole(e.target.value as typeof pRole)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="agent">agent — CRM portal only</option>
                <option value="admin">admin — CRM + admin dashboard</option>
                <option value="viewer">viewer — read-only</option>
              </select>
            </div>
            <p className="rounded-md bg-secondary p-2 text-xs text-muted-foreground">
              Agents sign in at /auth and land in the Lead CRM at /crm. They cannot open the superadmin dashboard.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPortalOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleCreatePortalUser} disabled={busy}>{busy ? "Creating…" : "Create login"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
