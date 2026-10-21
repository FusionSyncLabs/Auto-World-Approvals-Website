export const CRM_STATUSES = [
  { value: "partial", label: "Partial", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "new", label: "New", color: "bg-sky-100 text-sky-800 border-sky-300" },
  { value: "contact_attempted", label: "Contact attempted", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: "contacted", label: "Contacted", color: "bg-neutral-100 text-neutral-600 border-neutral-300" },
  { value: "qualified", label: "Qualified", color: "bg-violet-100 text-violet-800 border-violet-300" },
  { value: "sent_to_dealer", label: "Sent to dealer", color: "bg-amber-100 text-amber-900 border-amber-300" },
  { value: "approved", label: "Approved", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "sold", label: "Sold", color: "bg-green-600/15 text-green-800 border-green-400" },
  { value: "closed", label: "Closed", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "not_proceeding", label: "Not proceeding", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { value: "not_qualified", label: "Not qualified", color: "bg-rose-100 text-rose-800 border-rose-300" },
  { value: "archived", label: "Archived", color: "bg-neutral-100 text-neutral-600 border-neutral-300" },
] as const;

export const PIPELINE_STATUSES = [
  "new",
  "contact_attempted",
  "contacted",
  "qualified",
  "sent_to_dealer",
  "approved",
  "sold",
  "closed",
] as const;

export function statusMeta(value: string | null | undefined) {
  return CRM_STATUSES.find((s) => s.value === value) ?? CRM_STATUSES[1];
}

export function leadName(l: Record<string, unknown>) {
  const n = `${(l.first_name as string) ?? ""} ${(l.last_name as string) ?? ""}`.trim();
  return n || (l.email as string) || (l.phone as string) || "Unnamed lead";
}

export function leadChannel(l: Record<string, unknown>) {
  return (
    (l.attribution_channel as string) ||
    (l.utm_source as string) ||
    (l.source as string) ||
    "Direct"
  );
}

/**
 * A row only counts as a real lead once we have a way to contact the person.
 * Anonymous in-progress funnel rows (created before the contact step) are
 * kept in the database for resume/autosave but must never show up as leads.
 */
export function hasContactInfo(l: Record<string, unknown>) {
  const v = (k: string) => String((l[k] as string | null) ?? "").trim();
  // A row only counts as a lead once we can actually REACH the person — a name
  // typed into the funnel with no phone or email is not a lead. Anything we
  // already submitted or emailed out stays visible, no exceptions.
  const reachable = v("phone").replace(/\D/g, "").length >= 10 || /.+@.+\..+/.test(v("email"));
  return !!(
    reachable ||
    v("submitted_at") ||
    v("email_notified_at") ||
    !["draft", "partial"].includes(v("status"))
  );
}


