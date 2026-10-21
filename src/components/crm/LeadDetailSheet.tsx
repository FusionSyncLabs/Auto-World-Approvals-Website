import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCrmLead,
  updateCrmLead,
  addCrmNote,
  deleteCrmNote,
  listDeliverySettings,
  setLeadContactState,
  getCrmSession,
} from "@/lib/crm.functions";
import { CRM_STATUSES, leadChannel, leadName, statusMeta } from "@/lib/crm-constants";
import { scoreChipClass } from "@/lib/lead-score";
import { ScoreEmoji } from "@/components/crm/ScoreEmoji";
import { Mail, Phone, Send, Trash2, MessageSquarePlus, RotateCcw } from "lucide-react";

const SECTIONS: Array<{ title: string; fields: Array<[string, string]> }> = [
  {
    title: "Contact",
    fields: [
      ["email", "Email"],
      ["phone", "Phone"],
      ["date_of_birth", "Date of birth"],
      ["preferred_contact", "Preferred contact"],
      ["best_time_to_contact", "Best time"],
      ["street_address", "Address"],
      ["city", "City"],
      ["province", "Province"],
      ["postal_code", "Postal code"],
    ],
  },
  {
    title: "Vehicle & budget",
    fields: [
      ["vehicle_type", "Vehicle type"],
      ["monthly_budget", "Monthly budget"],
      ["down_payment", "Down payment"],
      ["has_trade_in", "Trade-in"],
      ["trade_in_year", "Trade year"],
      ["trade_in_make", "Trade make"],
      ["trade_in_model", "Trade model"],
      ["trade_in_mileage", "Mileage"],
      ["trade_in_amount_owing", "Amount owing"],
    ],
  },
  {
    title: "Credit & employment",
    fields: [
      ["credit_rating", "Credit rating"],
      ["employment_status", "Employment"],
      ["employment_length", "Employment length"],
      ["income_type", "Income type"],
      ["income_amount", "Income"],
      ["pay_frequency", "Pay frequency"],
      ["additional_income", "Additional income"],
      ["additional_income_source", "Additional income source"],
      ["additional_income_amount", "Additional income amount"],
      ["employer_name", "Employer"],
      ["job_title", "Job title"],
      ["industry", "Industry"],
      ["residence_status", "Residence"],
      ["monthly_housing_payment", "Housing payment"],
      ["has_drivers_licence", "Licence"],

    ],
  },
];

export function LeadDetailSheet({
  leadId,
  open,
  onOpenChange,
  onSend,
}: {
  leadId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSend: (leadId: string, name: string, sentTo: string[]) => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getCrmLead);
  const updateFn = useServerFn(updateCrmLead);
  const noteFn = useServerFn(addCrmNote);
  const delNoteFn = useServerFn(deleteCrmNote);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["crm-lead", leadId],
    queryFn: () => getFn({ data: { id: leadId as string } }),
    enabled: open && !!leadId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
    qc.invalidateQueries({ queryKey: ["crm-leads"] });
  };

  const update = useMutation({
    mutationFn: (patch: { status?: string; follow_up_date?: string | null }) =>
      updateFn({ data: { id: leadId as string, ...patch } }),
    onSuccess: () => {
      toast.success("Lead updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: () => noteFn({ data: { lead_id: leadId as string, body: note } }),
    onSuccess: () => {
      setNote("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: (id: string) => delNoteFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deliveryFn = useServerFn(listDeliverySettings);
  const sessionFn = useServerFn(getCrmSession);
  const contactStateFn = useServerFn(setLeadContactState);

  const { data: delivery } = useQuery({
    queryKey: ["delivery-settings"],
    queryFn: () => deliveryFn(),
    enabled: open,
  });
  const { data: me } = useQuery({ queryKey: ["crm-session"], queryFn: () => sessionFn(), enabled: open });

  const contactState = useMutation({
    mutationFn: (v: { contacted: boolean; first_contact_by?: string | null }) =>
      contactStateFn({ data: { id: leadId as string, ...v } }),
    onSuccess: (_r, v) => {
      toast.success(v.contacted ? "First contact updated" : "Lead marked uncontacted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lead = data?.lead as Record<string, unknown> | undefined;
  const score = Number(lead?.lead_score ?? 0);
  const name = lead ? leadName(lead) : "Lead";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="pr-8 text-left text-xl">{name}</SheetTitle>
          {lead && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-bold ${scoreChipClass(score)}`}>
                <ScoreEmoji score={score} /> {score}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta(lead.status as string).color}`}>
                {statusMeta(lead.status as string).label}
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                {leadChannel(lead)}
              </span>
            </div>
          )}
        </SheetHeader>

        {isLoading || !lead ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="flex-1 space-y-6 p-5 pb-28">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select value={(lead.status as string) ?? "new"} onValueChange={(v) => update.mutate({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRM_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fu">Follow-up date</Label>
                <Input
                  id="fu"
                  type="date"
                  defaultValue={(lead.follow_up_date as string) ?? ""}
                  onChange={(e) => update.mutate({ follow_up_date: e.target.value || null })}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!!lead.phone && (
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${lead.phone}`}><Phone className="h-4 w-4" /> Call</a>
                </Button>
              )}
              {!!lead.email && (
                <Button asChild variant="outline" size="sm">
                  <a href={`mailto:${lead.email}`}><Mail className="h-4 w-4" /> Email</a>
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => onSend(leadId as string, name, (data?.sends ?? []).map((s) => s.recipient_email))}
              >
                <Send className="h-4 w-4" /> Send details
              </Button>
            </div>

            <div className="rounded-lg border border-border p-3">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">First contact</h3>
              {lead.first_contacted_at ? (
                <p className="text-sm">
                  <span className="font-semibold">{(lead.first_contact_by as string) || "Unknown"}</span>
                  {" · "}
                  {new Date(lead.first_contacted_at as string).toLocaleString()}
                  {lead.first_contact_source === "auto_delivery" && (
                    <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[17px] text-muted-foreground">
                      auto delivered
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Not contacted yet.</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select
                  value={(lead.first_contact_by as string) ?? ""}
                  onValueChange={(v) => contactState.mutate({ contacted: true, first_contact_by: v })}
                >
                  <SelectTrigger className="h-9 w-full sm:w-64">
                    <SelectValue placeholder="Set first contact…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(delivery?.contacts ?? []).map((c) => {
                      const label = c.name ? `${c.name} (${c.email})` : c.email;
                      return (
                        <SelectItem key={c.id} value={label}>
                          {label}
                        </SelectItem>
                      );
                    })}
                    {me?.full_name || me?.email ? (
                      <SelectItem value={(me.full_name || me.email) as string}>
                        {(me.full_name || me.email) as string} (me)
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                {lead.first_contacted_at ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => contactState.mutate({ contacted: false })}
                    disabled={contactState.isPending}
                  >
                    <RotateCcw className="h-4 w-4" /> Mark uncontacted
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => contactState.mutate({ contacted: true })}
                    disabled={contactState.isPending}
                  >
                    Mark contacted
                  </Button>
                )}
              </div>
            </div>

            {SECTIONS.map((sec) => {
              const rows = sec.fields.filter(([k]) => {
                const v = lead[k];
                return v !== null && v !== undefined && String(v).trim() !== "";
              });
              if (!rows.length) return null;
              return (
                <div key={sec.title}>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{sec.title}</h3>
                  <dl className="grid gap-x-4 gap-y-1.5 rounded-lg border border-border p-3 sm:grid-cols-2">
                    {rows.map(([k, label]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-[17px] uppercase text-muted-foreground">{label}</dt>
                        <dd className="truncate text-sm font-medium">{String(lead[k])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}

            <div>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Notes</h3>
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  placeholder="Add a note about this lead…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button size="sm" onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending}>
                  <MessageSquarePlus className="h-4 w-4" /> Add note
                </Button>
              </div>
              <ul className="mt-3 space-y-2">
                {(data?.notes ?? []).map((n) => (
                  <li key={n.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 whitespace-pre-wrap text-sm">{n.body}</p>
                      <button
                        onClick={() => removeNote.mutate(n.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-1 text-[17px] text-muted-foreground">
                      {n.author_name} · {new Date(n.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {!!(data?.sends ?? []).length && (
              <div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Sent to</h3>
                <ul className="space-y-1 text-sm">
                  {data!.sends.map((s) => (
                    <li key={s.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-border px-3 py-2">
                      <span className="font-medium">{s.recipient_email}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.sender_name} · {new Date(s.sent_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
