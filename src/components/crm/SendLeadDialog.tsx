import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listCrmContacts, saveCrmContact, sendLeadToRecipients } from "@/lib/crm.functions";
import { listDeliveryContactsFlat } from "@/lib/distribution.functions";
import { Send, Plus } from "lucide-react";

export function SendLeadDialog({
  leadId,
  leadName,
  open,
  onOpenChange,
  alreadySent,
}: {
  leadId: string;
  leadName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alreadySent: string[];
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCrmContacts);
  const saveFn = useServerFn(saveCrmContact);
  const sendFn = useServerFn(sendLeadToRecipients);

  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ["crm-contacts"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const deliveryFn = useServerFn(listDeliveryContactsFlat);
  const { data: deliveryContacts = [] } = useQuery({
    queryKey: ["delivery-contacts-flat"],
    queryFn: () => deliveryFn(),
    enabled: open,
  });

  const sentSet = useMemo(() => new Set(alreadySent.map((e) => e.toLowerCase())), [alreadySent]);

  const addContact = useMutation({
    mutationFn: () => saveFn({ data: { name: newName, email: newEmail } }),
    onSuccess: () => {
      toast.success("Contact saved");
      setNewName("");
      setNewEmail("");
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["crm-contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => {
      const extras = manual
        .split(/[,\s;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return sendFn({ data: { lead_id: leadId, recipients: [...selected, ...extras], message } });
    },
    onSuccess: (r) => {
      toast.success(`Sent to ${r.sent} recipient${r.sent === 1 ? "" : "s"}`);
      setSelected([]);
      setManual("");
      setMessage("");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send {leadName}&rsquo;s details</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">
          Only applicant information is included — no campaign or marketing data.
        </p>

        <div className="space-y-2">
          <Label>Saved contacts</Label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {contacts.length === 0 && <p className="p-2 text-sm text-muted-foreground">No saved contacts yet.</p>}
            {contacts.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted">
                <Checkbox
                  checked={selected.includes(c.email)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v ? [...prev, c.email] : prev.filter((e) => e !== c.email)))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                </span>
                {sentSet.has(c.email.toLowerCase()) && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[17px] font-semibold text-emerald-800">
                    Sent
                  </span>
                )}
              </label>
            ))}
          </div>
          {adding ? (
            <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
              <NameInput placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="email@company.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <div className="flex gap-2 sm:col-span-2">
                <Button size="sm" onClick={() => addContact.mutate()} disabled={addContact.isPending}>
                  Save contact
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add to contact library
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label>Lead client contact library</Label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {deliveryContacts.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">No delivery contacts yet.</p>
            )}
            {deliveryContacts.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted">
                <Checkbox
                  checked={selected.includes(c.email)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v ? [...prev, c.email] : prev.filter((e) => e !== c.email)))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name || c.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.email}
                    {c.list_name ? ` · ${c.list_name}` : ""}
                    {c.kind === "admin" ? " · admin" : ""}
                    {!c.is_active ? " · inactive" : ""}
                  </span>
                </span>
                {sentSet.has(c.email.toLowerCase()) && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[17px] font-semibold text-emerald-800">
                    Sent
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual">One-off emails</Label>
          <Input
            id="manual"
            placeholder="someone@dealer.com, other@dealer.com"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="msg">Note to recipient (optional)</Label>
          <Textarea id="msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        <DialogFooter>
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            <Send className="h-4 w-4" /> {send.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
