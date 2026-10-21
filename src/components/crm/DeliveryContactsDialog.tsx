import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addDeliveryContact,
  deleteDeliveryContact,
  listDeliverySettings,
  updateDeliveryContact,
} from "@/lib/crm.functions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, Send, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

export function DeliveryContactsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const listFn = useServerFn(listDeliverySettings);
  const addFn = useServerFn(addDeliveryContact);
  const delFn = useServerFn(deleteDeliveryContact);
  const updFn = useServerFn(updateDeliveryContact);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["delivery-settings"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"admin" | "client">("client");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["delivery-settings"] });

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { email, name, kind } }),
    onSuccess: () => {
      setEmail("");
      setName("");
      invalidate();
      toast.success("Contact added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Contact removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeMut = useMutation({
    mutationFn: (v: { id: string; is_active?: boolean; is_first_contact?: boolean }) => updFn({ data: v }),
    onSuccess: (_r, v) => {
      invalidate();
      if (v.is_first_contact !== undefined) {
        toast.success(v.is_first_contact ? "First point of contact set" : "First point of contact cleared");
      } else {
        toast.success(v.is_active ? "Auto delivery on for this contact" : "Auto delivery off for this contact");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contacts = data?.contacts ?? [];
  const admins = contacts.filter((c) => c.kind === "admin");
  const clients = contacts.filter((c) => c.kind !== "admin");

  const renderContact = (c: (typeof contacts)[number]) => (
    <div
      key={c.id}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        c.is_active
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-border bg-card"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{c.name || c.email}</p>
        {c.name && <p className="truncate text-xs text-muted-foreground">{c.email}</p>}
        <p className="mt-0.5 text-[17px] text-muted-foreground">
          {c.last_delivered_at
            ? `Last delivery ${new Date(c.last_delivered_at).toLocaleString()}`
            : "No leads delivered yet"}
        </p>
      </div>
      <span
        title="Leads auto-delivered to this contact"
        className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-bold tabular-nums"
      >
        {c.delivered_count}
      </span>
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <Switch checked={c.is_active} onCheckedChange={(v) => activeMut.mutate({ id: c.id, is_active: v })} />
        <span className="text-[17px] font-semibold uppercase tracking-wide text-muted-foreground">
          {c.is_active ? "Auto on" : "Auto off"}
        </span>
      </div>

      <Button
        size="icon"
        variant="ghost"
        className="text-destructive"
        onClick={() => {
          if (confirm(`Remove ${c.email} from lead delivery?`)) delMut.mutate(c.id);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Automatic lead delivery
          </DialogTitle>
          <DialogDescription>
            New leads are emailed automatically. Admin recipients get the complete lead including our internal
            marketing and attribution data. Client recipients only ever get the applicant's own information. Existing
            leads are never re-sent.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-6">
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              The starred recipient is the first point of contact. A lead is marked contacted only when auto delivery
              to that active recipient succeeds. Deliveries to other recipients do not change its status.
            </p>
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">Admin recipients — full lead</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Internal Auto World Approvals staff. Receives everything: applicant info plus source, campaign, ad
                click IDs, consents and CRM data.
              </p>
              {admins.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
                  No admin recipients yet.
                </p>
              ) : (
                admins.map(renderContact)
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">Client recipients — applicant info only</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Outside dealers and lenders. Never receives campaign, ad or tracking data.
              </p>
              {clients.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
                  No client recipients yet.
                </p>
              ) : (
                clients.map(renderContact)
              )}
            </section>

            <form
              className="space-y-2 rounded-xl border border-border bg-muted/40 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                addMut.mutate();
              }}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <NameInput placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                <Input
                  type="email"
                  placeholder="email@dealership.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden rounded-lg border border-border">
                  {(["client", "admin"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`px-3 py-1.5 text-xs font-semibold ${
                        kind === k ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                      }`}
                    >
                      {k === "admin" ? "Admin (full lead)" : "Client (applicant only)"}
                    </button>
                  ))}
                </div>
                <Button type="submit" disabled={addMut.isPending || !email.trim()} className="ml-auto">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </form>

            <p className="text-xs text-muted-foreground">{data?.total_delivered ?? 0} auto deliveries total</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
