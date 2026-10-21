import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, MapPin, Plus, Repeat, Send, ShieldCheck, Trash2, Users } from "lucide-react";
import {
  addListContact,
  assignContactToList,
  deleteDistributionList,
  deleteListContact,
  listDistribution,
  setListContactActive,
  setNextContact,
  setRotationOrder,
  upsertDistributionList,
  type DistributionList,
  type DeliveryRange,
} from "@/lib/distribution.functions";
import { DeliveryCountDialog } from "@/components/crm/DeliveryCountDialog";


const RANGE_LABELS: Record<DeliveryRange, string> = {
  this_month: "This month",
  last_7: "Last 7 days",
  last_30: "Last 30 days",
  this_year: "This year",
  all: "All time",
};


export const Route = createFileRoute("/_authenticated/admin/distribution/")({
  head: () => ({ meta: [{"title": "Lead distribution | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals lead distribution area for authorized users."}, {"property": "og:title", "content": "Lead distribution | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals lead distribution area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}],
  }),
  component: DistributionPage,
});

type Draft = {
  id?: string;
  name: string;
  description: string;
  provinces: string;
  cities: string;
  mode: "round_robin" | "all";
  marks_contacted: boolean;
  is_active: boolean;
  priority: number;
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  provinces: "",
  cities: "",
  mode: "round_robin",
  marks_contacted: true,
  is_active: true,
  priority: 0,
};

function DistributionPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDistribution);
  const upsertFn = useServerFn(upsertDistributionList);
  const deleteFn = useServerFn(deleteDistributionList);
  const assignFn = useServerFn(assignContactToList);
  const orderFn = useServerFn(setRotationOrder);
  const nextContactFn = useServerFn(setNextContact);
  const addFn = useServerFn(addListContact);
  const activeFn = useServerFn(setListContactActive);
  const removeContactFn = useServerFn(deleteListContact);

  const [range, setRange] = useState<DeliveryRange>("this_month");
  const { data, isLoading } = useQuery({
    queryKey: ["distribution", range],
    queryFn: () => listFn({ data: { range } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["distribution"] });
  const rangeLabel = RANGE_LABELS[range];
  const [countContact, setCountContact] = useState<{ id: string; label: string } | null>(null);



  const [draft, setDraft] = useState<Draft | null>(null);
  const [newContact, setNewContact] = useState<Record<string, { name: string; email: string }>>({});

  const lists = data?.lists ?? [];
  const members = useMemo(() => data?.members ?? [], [data]);
  const unassigned = members.filter((m) => !m.list_id && m.kind !== "admin");
  const admins = members.filter((m) => m.kind === "admin");
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "" });

  const saveMut = useMutation({
    mutationFn: (d: Draft) =>
      upsertFn({
        data: {
          id: d.id,
          name: d.name,
          description: d.description,
          provinces: d.provinces.split(",").map((s) => s.trim()).filter(Boolean),
          cities: d.cities.split(",").map((s) => s.trim()).filter(Boolean),
          mode: d.mode,
          marks_contacted: d.marks_contacted,
          is_active: d.is_active,
          priority: d.priority,
        },
      }),
    onSuccess: () => {
      setDraft(null);
      invalidate();
      toast.success("Distribution list saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const simple = <T,>(fn: (v: T) => Promise<unknown>, msg: string) =>
    ({
      mutationFn: fn,
      onSuccess: () => {
        invalidate();
        toast.success(msg);
      },
      onError: (e: Error) => toast.error(e.message),
    }) as const;

  const deleteMut = useMutation(simple((id: string) => deleteFn({ data: { id } }), "List deleted"));
  const assignMut = useMutation(
    simple(
      (v: { contact_id: string; list_id: string | null }) => assignFn({ data: v }),
      "Recipient moved",
    ),
  );
  const orderMut = useMutation(simple((ids: string[]) => orderFn({ data: { ids } }), "Rotation reordered"));
  const nextContactMut = useMutation(
    simple(
      (v: { list_id: string; contact_id: string | null }) => nextContactFn({ data: v }),
      "Next recipient updated",
    ),
  );
  const removeContactMut = useMutation(simple((id: string) => removeContactFn({ data: { id } }), "Recipient removed"));
  const addMut = useMutation(
    simple(
      (v: { email: string; name: string; list_id: string | null; kind?: "admin" | "client" }) => addFn({ data: v }),
      "Recipient added",
    ),
  );
  const activeMut = useMutation(
    simple((v: { id: string; is_active: boolean }) => activeFn({ data: v }), "Recipient updated"),
  );

  const toDraft = (l: DistributionList): Draft => ({
    id: l.id,
    name: l.name,
    description: l.description ?? "",
    provinces: (l.provinces ?? []).join(", "),
    cities: (l.cities ?? []).join(", "),
    mode: l.mode,
    marks_contacted: l.marks_contacted,
    is_active: l.is_active,
    priority: l.priority,
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Lead distribution</h1>
            <p className="text-sm text-muted-foreground">
              Build lists of client recipients and alternate new leads between them. Scope a list to provinces or
              cities and the best geographic match wins; a list with no scope is the fallback for everyone else. No
              lead is ever dropped — if nothing matches (out-of-province or no address yet) it goes to the
              highest-priority list.
            </p>

          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="delivered-range">
              Delivered counts:
            </label>
            <select
              id="delivered-range"
              value={range}
              onChange={(e) => setRange(e.target.value as DeliveryRange)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {(Object.keys(RANGE_LABELS) as DeliveryRange[]).map((r) => (
                <option key={r} value={r}>
                  {RANGE_LABELS[r]}
                </option>
              ))}
            </select>
            <Button onClick={() => setDraft({ ...emptyDraft })}>
              <Plus className="h-4 w-4" /> New list
            </Button>
          </div>

        </header>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="h-4 w-4 text-primary" /> Admin recipients — full lead
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Internal Auto World Approvals staff. They receive <strong>every</strong> new lead in full: applicant
                info plus source, campaign, ad click IDs, consents and CRM data. They are never part of a rotation.
              </p>
              <div className="mt-3 space-y-2">
                {admins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No admin recipients yet.</p>
                ) : (
                  admins.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{a.name || a.email}</p>
                        {a.name && <p className="truncate text-xs text-muted-foreground">{a.email}</p>}
                      </div>
                      <button
                        type="button"
                        title={`Leads delivered — ${rangeLabel} (click to edit the count)`}
                        onClick={() => setCountContact({ id: a.id, label: a.name || a.email })}
                        className="flex min-w-[88px] flex-col items-center rounded-md border border-border bg-muted px-2.5 py-1 text-center transition hover:border-primary hover:bg-muted/70"
                      >
                        <strong className="text-xs font-bold tabular-nums">{a.delivered_count} leads</strong>
                        <span className="text-[17px] font-medium text-muted-foreground">{rangeLabel}</span>
                      </button>

                      <span className="rounded-full border border-border px-2 py-0.5 text-[17px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Always sent
                      </span>

                      <Switch
                        checked={a.is_active}
                        onCheckedChange={(v) => activeMut.mutate({ id: a.id, is_active: v })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Remove ${a.email} from lead delivery?`)) removeContactMut.mutate(a.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <form
                className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newAdmin.email.trim()) return;
                  addMut.mutate({ email: newAdmin.email, name: newAdmin.name, list_id: null, kind: "admin" });
                  setNewAdmin({ name: "", email: "" });
                }}
              >
                <NameInput
                  className="w-40"
                  pattern="[A-Za-z ]*"
                  title="Use English letters and spaces only"
                  maxLength={100}
                  placeholder="Name (optional)"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                />
                <Input
                  className="w-56"
                  type="email"
                  placeholder="staff@autoworldapprovals.com"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                />
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" /> Add admin recipient
                </Button>
              </form>
            </section>

            {lists.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No distribution lists yet. Create one to start rotating leads between recipients.
              </p>
            )}

            {lists.map((l) => {
              const rows = members
                .filter((m) => m.list_id === l.id)
                .sort((a, b) => a.rotation_order - b.rotation_order || a.created_at.localeCompare(b.created_at));
              const ids = rows.map((r) => r.id);
              const nc = newContact[l.id] ?? { name: "", email: "" };
              const nextUp = rows.filter((r) => r.is_active);
              const lastIdx = nextUp.findIndex((r) => r.id === l.last_assigned_contact_id);
              const pinned = nextUp.find((r) => r.id === l.next_contact_id) ?? null;
              const upNext = pinned ?? (nextUp.length ? nextUp[(lastIdx + 1) % nextUp.length] : null);

              return (
                <section key={l.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold">{l.name}</h2>
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[17px] font-semibold uppercase tracking-wide">
                          {rows.filter((row) => row.is_active).length > 1 ? "Alternating" : "Single recipient"}
                        </span>
                        {!l.is_active && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[17px] font-semibold text-destructive">
                            Paused
                          </span>
                        )}
                      </div>
                      {l.description && <p className="mt-1 text-sm text-muted-foreground">{l.description}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {(l.cities ?? []).length || (l.provinces ?? []).length
                          ? [...(l.cities ?? []), ...(l.provinces ?? [])].join(", ")
                          : "Fallback list — any location"}
                      </p>
                      {(
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {upNext && (
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <Repeat className="h-3.5 w-3.5" /> Next lead goes to {upNext.name || upNext.email}
                              {pinned && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[17px] uppercase tracking-wide">
                                  Pinned
                                </span>
                              )}
                            </p>
                          )}
                          {nextUp.length > 0 && (
                            <select
                              className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                              value={l.next_contact_id ?? ""}
                              onChange={(e) =>
                                nextContactMut.mutate({
                                  list_id: l.id,
                                  contact_id: e.target.value || null,
                                })
                              }
                            >
                              <option value="">Auto (keep alternating)</option>
                              {nextUp.map((r) => (
                                <option key={r.id} value={r.id}>
                                  Send next lead to {r.name || r.email}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDraft(toDraft(l))}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${l.name}"? Recipients stay but become unassigned.`))
                            deleteMut.mutate(l.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {rows.length === 0 && (
                      <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
                        No recipients in this list yet.
                      </p>
                    )}
                    {rows.map((m, i) => (
                      <div
                        key={m.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                      >
                        <span className="w-6 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{m.name || m.email}</p>
                          {m.name && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                        </div>
                        <button
                          type="button"
                          title={`Leads delivered — ${rangeLabel} (click to edit the count)`}
                          onClick={() => setCountContact({ id: m.id, label: m.name || m.email })}
                          className="flex min-w-[88px] flex-col items-center rounded-md border border-border bg-muted px-2.5 py-1 text-center transition hover:border-primary hover:bg-muted/70"
                        >
                          <strong className="text-xs font-bold tabular-nums">{m.delivered_count} leads</strong>
                          <span className="text-[17px] font-medium text-muted-foreground">{rangeLabel}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={i === 0}
                            onClick={() => {
                              const next = [...ids];
                              [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                              orderMut.mutate(next);
                            }}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={i === rows.length - 1}
                            onClick={() => {
                              const next = [...ids];
                              [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
                              orderMut.mutate(next);
                            }}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                        <Switch
                          checked={m.is_active}
                          onCheckedChange={(v) => activeMut.mutate({ id: m.id, is_active: v })}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => assignMut.mutate({ contact_id: m.id, list_id: null })}
                        >
                          Unassign
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Remove ${m.email} from lead delivery entirely?`))
                              removeContactMut.mutate(m.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <form
                    className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!nc.email.trim()) return;
                      addMut.mutate({ email: nc.email, name: nc.name, list_id: l.id });
                      setNewContact((s) => ({ ...s, [l.id]: { name: "", email: "" } }));
                    }}
                  >
                    <NameInput
                      className="w-40"
                      pattern="[A-Za-z ]*"
                      title="Use English letters and spaces only"
                      maxLength={100}
                      placeholder="Name (optional)"
                      value={nc.name}
                      onChange={(e) => setNewContact((s) => ({ ...s, [l.id]: { ...nc, name: e.target.value } }))}
                    />
                    <Input
                      className="w-56"
                      type="email"
                      placeholder="email@dealership.com"
                      value={nc.email}
                      onChange={(e) => setNewContact((s) => ({ ...s, [l.id]: { ...nc, email: e.target.value } }))}
                    />
                    <Button type="submit" size="sm">
                      <Plus className="h-4 w-4" /> Add recipient
                    </Button>
                    {unassigned.length > 0 && (
                      <select
                        className="ml-auto rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) assignMut.mutate({ contact_id: e.target.value, list_id: l.id });
                        }}
                      >
                        <option value="">Move an existing recipient here…</option>
                        {unassigned.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name ? `${u.name} (${u.email})` : u.email}
                          </option>
                        ))}
                      </select>
                    )}
                  </form>
                </section>
              );
            })}

            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Users className="h-4 w-4" /> Unassigned client recipients
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                 These recipients receive an informational copy of every new lead. They are never the paying-client
                 owner and never become first contact. Move them into a list to make them eligible for assignment.
              </p>

              <div className="mt-3 space-y-2">
                {unassigned.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None — everyone is in a distribution list.</p>
                ) : (
                  unassigned.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <Send className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{u.name || u.email}</p>
                        {u.name && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
                      </div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[17px] font-semibold uppercase tracking-wide text-muted-foreground">
                        No rotation
                      </span>

                      <Switch
                        checked={u.is_active}
                        onCheckedChange={(v) => activeMut.mutate({ id: u.id, is_active: v })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Remove ${u.email} from lead delivery?`)) removeContactMut.mutate(u.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {lists.length > 0 && (
                        <select
                          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                          value=""
                          onChange={(e) => {
                            if (e.target.value)
                              assignMut.mutate({ contact_id: u.id, list_id: e.target.value });
                          }}
                        >
                          <option value="">Add to list…</option>
                          {lists.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit distribution list" : "New distribution list"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={draft.name}
                  placeholder="BC dealers"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Provinces (comma separated)</Label>
                  <Input
                    value={draft.provinces}
                    placeholder="BC, Alberta"
                    onChange={(e) => setDraft({ ...draft, provinces: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cities (comma separated)</Label>
                  <Input
                    value={draft.cities}
                    placeholder="Kelowna, Calgary"
                    onChange={(e) => setDraft({ ...draft, cities: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave both blank to make this the fallback list for leads that match no other list. City matches beat
                province matches. If no list matches at all, the lead still goes to the highest-priority list.
              </p>

              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold">One paying client per lead</p>
                <p className="text-xs text-muted-foreground">
                  Multiple active clients alternate in order. A list with one active client always assigns that client.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">Mark leads contacted</p>
                  <p className="text-xs text-muted-foreground">
                    The recipient this list assigns becomes the lead's first point of contact.
                  </p>
                </div>
                <Switch
                  checked={draft.marks_contacted}
                  onCheckedChange={(v) => setDraft({ ...draft, marks_contacted: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">Active</p>
                  <p className="text-xs text-muted-foreground">Paused lists never receive leads.</p>
                </div>
                <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  Higher priority wins when two lists match the same location.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={saveMut.isPending || !draft?.name.trim()} onClick={() => draft && saveMut.mutate(draft)}>
              Save list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeliveryCountDialog
        contactId={countContact?.id ?? null}
        contactLabel={countContact?.label ?? ""}
        range={range}
        rangeLabel={rangeLabel}
        onOpenChange={(open) => !open && setCountContact(null)}
      />
    </AdminLayout>

  );
}
