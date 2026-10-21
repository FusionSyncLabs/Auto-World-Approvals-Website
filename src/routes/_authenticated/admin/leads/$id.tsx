import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLeadAssignment } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/leads/$id")({
  head: () => ({ meta: [
    { title: "Lead Details | Auto World Approvals Admin" },
    { name: "description", content: "Review applicant details, assigned recipient, first contact and internal notes." },
    { property: "og:title", content: "Lead Details | Auto World Approvals Admin" },
    { property: "og:description", content: "Review applicant details, assigned recipient, first contact and internal notes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: LeadDetail,
});

const STATUSES = ["new", "contacted", "qualified", "sent_to_dealer", "approved", "sold", "not_qualified", "duplicate", "archived"] as const;

function LeadDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const assignmentFn = useServerFn(getLeadAssignment);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: assignment, isLoading: assignmentLoading, isError: assignmentError } = useQuery({
    queryKey: ["lead-assignment", id],
    queryFn: () => assignmentFn({ data: { id } }),
  });

  const { data: notes } = useQuery({
    queryKey: ["lead-notes", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = async (status: string) => {
    await supabase.from("leads").update({ status: status as never }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["lead", id] });
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("lead_notes").insert({ lead_id: id, author_id: user.id, body: note });
    setNote("");
    setSavingNote(false);
    qc.invalidateQueries({ queryKey: ["lead-notes", id] });
  };

  const remove = async () => {
    if (!confirm("Delete this lead permanently?")) return;
    await supabase.from("leads").delete().eq("id", id);
    navigate({ to: "/admin/leads" });
  };

  if (isLoading) return <AdminLayout><p>Loading…</p></AdminLayout>;
  if (!lead) return <AdminLayout><p>Lead not found.</p></AdminLayout>;

  const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
  const sections: { title: string; fields: [string, string][] }[] = [
    { title: "Contact", fields: [["First name", s(lead.first_name)], ["Last name", s(lead.last_name)], ["Email", s(lead.email)], ["Phone", s(lead.phone)], ["DOB", s(lead.date_of_birth)], ["Preferred contact", s(lead.preferred_contact)]] },
    { title: "Vehicle", fields: [["Type", s(lead.vehicle_type)], ["Monthly budget", s(lead.monthly_budget)], ["Down payment", s(lead.down_payment)]] },
    { title: "Trade-in", fields: [["Has trade-in", s(lead.has_trade_in)], ["Year", s(lead.trade_in_year)], ["Make", s(lead.trade_in_make)], ["Model", s(lead.trade_in_model)], ["Trim", s(lead.trade_in_trim)], ["Mileage", s(lead.trade_in_mileage)], ["Condition", s(lead.trade_in_condition)], ["Loan owing", s(lead.trade_in_loan_owing)], ["Amount owing", s(lead.trade_in_amount_owing)]] },
    { title: "Credit & Employment", fields: [["Credit rating", s(lead.credit_rating)], ["Employment", s(lead.employment_status)], ["Employment length", s(lead.employment_length)], ["Income type", s(lead.income_type)], ["Income amount", s(lead.income_amount)], ["Pay frequency", s(lead.pay_frequency)], ["Additional income", s(lead.additional_income)], ["Additional income source", s(lead.additional_income_source)], ["Additional income amount", s(lead.additional_income_amount)], ["Years/Months", `${s(lead.income_years)}y ${s(lead.income_months)}m`], ["Employer", s(lead.employer_name)], ["Job title", s(lead.job_title)], ["Employer phone", s(lead.employer_phone)], ["Industry", s(lead.industry)], ["Business name", s(lead.business_name)], ["Business type", s(lead.business_type)], ["Years in business", s(lead.years_in_business)]] },
    { title: "Residence", fields: [["Status", s(lead.residence_status)], ["Monthly payment", s(lead.monthly_housing_payment)], ["Address time", `${s(lead.address_years)}y ${s(lead.address_months)}m`], ["Street", s(lead.street_address)], ["City", s(lead.city)], ["Province", s(lead.province)], ["Postal code", s(lead.postal_code)], ["Prev street", s(lead.prev_street_address)], ["Prev city", s(lead.prev_city)], ["Prev province", s(lead.prev_province)], ["Prev postal", s(lead.prev_postal_code)]] },
    { title: "Licence", fields: [["Has licence", s(lead.has_drivers_licence)], ["Licence class", s(lead.licence_class)]] },
    { title: "Consent & Tracking", fields: [["Consented accuracy", String(lead.consent_accuracy)], ["Consented contact", String(lead.consent_contact)], ["Consented credit", String(lead.consent_credit_check)], ["Marketing opt-in", String(lead.consent_marketing)], ["Consent IP", s(lead.consent_ip)], ["Consent at", s(lead.consent_timestamp)], ["Source", s(lead.source)], ["Traffic channel", s((lead as Record<string, unknown>).attribution_channel as string | null)], ["Google click ID", s((lead as Record<string, unknown>).gclid as string | null)], ["Facebook click ID", s((lead as Record<string, unknown>).fbclid as string | null)], ["UTM source", s(lead.utm_source)], ["UTM medium", s(lead.utm_medium)], ["UTM campaign", s(lead.utm_campaign)], ["Referrer", s(lead.referrer)], ["Landing page", s(lead.landing_page)], ["Device", s(lead.device)]] },
  ];

  return (
    <AdminLayout>
      <div className="mb-4"><Link to="/admin/leads" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to leads</Link></div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{lead.first_name ?? ""} {lead.last_name ?? "(no name)"}</h1>
                <p className="text-sm text-muted-foreground">{lead.email ?? "—"} · {lead.phone ?? "—"}</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-semibold text-muted-foreground">Assigned to</dt>
                    <dd className="mt-1 break-words font-medium text-foreground">
                      {assignmentLoading ? "Loading assignment…" : assignmentError ? "Unable to load assignment" : assignment?.lead_delivery_contacts ? (
                        <>
                          <span>{assignment.lead_delivery_contacts.name || assignment.lead_delivery_contacts.email}</span>
                          {assignment.lead_delivery_contacts.name && <span className="block text-muted-foreground">{assignment.lead_delivery_contacts.email}</span>}
                          {assignment.distribution_lists?.name && <span className="block text-muted-foreground">{assignment.distribution_lists.name}</span>}
                        </>
                      ) : assignment ? "Assigned recipient unavailable" : "Not assigned"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-muted-foreground">First contact</dt>
                    <dd className="mt-1 break-words text-foreground">
                      {lead.first_contact_by || "Not contacted yet"}
                      {lead.first_contacted_at && <span className="block text-muted-foreground">{new Date(lead.first_contacted_at).toLocaleString()}</span>}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-electric-gradient px-3 py-1 text-xs font-semibold text-white">Score {lead.lead_score}</span>
                <Button variant="ghost" size="sm" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </div>

          {sections.map((s) => (
            <div key={s.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h2 className="mb-4 font-semibold">{s.title}</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                {s.fields.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">{v || <span className="text-muted-foreground">—</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-3 font-semibold">Status</h2>
            <select value={lead.status} onChange={(e) => updateStatus(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <p className="mt-3 text-xs text-muted-foreground">Created {new Date(lead.created_at).toLocaleString()}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-3 font-semibold">Internal notes</h2>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" rows={3} />
            <Button onClick={addNote} disabled={savingNote || !note.trim()} variant="navy" size="sm" className="mt-2 w-full">Add note</Button>
            <div className="mt-4 space-y-3">
              {(notes ?? []).map((n) => (
                <div key={n.id} className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                  <p>{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
              {(notes ?? []).length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
