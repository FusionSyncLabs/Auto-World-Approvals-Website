import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listCrmContacts, saveCrmContact, deleteCrmContact } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm/contacts")({
  head: () => ({ meta: [{"title": "CRM Contacts \u2014 Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals crm contacts area for authorized users."}, {"property": "og:title", "content": "CRM Contacts \u2014 Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals crm contacts area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: ContactsPage,
});

function ContactsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCrmContacts);
  const saveFn = useServerFn(saveCrmContact);
  const delFn = useServerFn(deleteCrmContact);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");

  const { data: contacts = [], isLoading } = useQuery({ queryKey: ["crm-contacts"], queryFn: () => listFn() });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { name, email, company } }),
    onSuccess: () => {
      toast.success("Contact saved");
      setName(""); setEmail(""); setCompany("");
      qc.invalidateQueries({ queryKey: ["crm-contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contacts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Contacts</h1>
        <p className="text-sm text-muted-foreground">Saved recipients you can quick-select when sending a lead.</p>
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <NameInput placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="email@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {contacts.map((c) => (
            <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.email}{c.company ? ` · ${c.company}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(c.id)} aria-label="Delete contact">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {!contacts.length && <li className="p-6 text-center text-sm text-muted-foreground">No contacts yet.</li>}
        </ul>
      )}
    </div>
  );
}
