import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StepShell } from "./StepShell";
import { VEHICLE_TYPES, VEHICLE_CONDITIONS, BUDGETS, DOWN_PAYMENTS, TRADE_IN, PROVINCES, PURCHASE_TIMELINES, EMPLOYMENT, PAY_FREQUENCIES, TIME_LENGTHS, type FunnelData, type ChoiceOption } from "@/lib/funnel/schema";
import { ArrowLeft, ArrowRight, Loader2, Pencil } from "lucide-react";

const label = (options: ChoiceOption[], value?: string) => options.find((o) => o.value === value)?.label || "Not specified";
const formatDob = (iso?: string) => {
  if (!iso) return "Not specified";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
};
export function IntakeReview({ data, update, onBack, onEdit, onSubmit, submitting, errorMsg }: {
  data: FunnelData; update: (p: Partial<FunnelData>) => void; onBack: () => void;
  onEdit: (step: "vehicle_type" | "monthly_budget" | "address_details" | "street_address" | "employment_status" | "income" | "employment_length" | "date_of_birth" | "contact") => void;
  onSubmit: (p: Partial<FunnelData>) => void; submitting: boolean; errorMsg: string | null;
}) {
  const acknowledged = data.consent_contact === true;
  const groups = [
    { step: "vehicle_type" as const, title: "Vehicle", text: `${label(VEHICLE_TYPES, data.vehicle_type)} · ${label(VEHICLE_CONDITIONS, data.vehicle_condition)}` },
    { step: "monthly_budget" as const, title: "Budget preference", text: `${label(BUDGETS, data.monthly_budget)} · Down payment: ${label(DOWN_PAYMENTS, data.down_payment)} · Trade-in: ${label(TRADE_IN, data.has_trade_in)}` },
    { step: "address_details" as const, title: "Location & timing", text: `${[data.street_address, data.city || data.postal_code].filter(Boolean).join(", ")}, ${label(PROVINCES, data.province)} · ${label(PURCHASE_TIMELINES, data.purchase_timeline)}` },
    { step: "employment_status" as const, title: "Employment / income source", text: label(EMPLOYMENT, data.employment_status) },
    { step: "income" as const, title: "Gross income", text: `${data.income_amount} · ${label(PAY_FREQUENCIES, data.pay_frequency)}` },
    ...(["employed", "self_employed"].includes(data.employment_status || "") ? [{ step: "employment_length" as const, title: "Employment tenure", text: label(TIME_LENGTHS, data.employment_length) }] : []),
    { step: "date_of_birth" as const, title: "Date of birth", text: formatDob(data.date_of_birth) },
    { step: "contact" as const, title: "Contact", text: `${data.first_name} ${data.last_name} · ${data.phone} · ${data.email}` },
  ];
  return <StepShell title="Review your inquiry" description="An advisor will review your request. This is not an approval or a loan offer.">
    <dl className="divide-y divide-border">{groups.map((g) => <div key={g.step} className="flex gap-3 py-4">
      <div className="min-w-0 flex-1"><dt className="font-semibold [overflow-wrap:anywhere]">{g.title}</dt><dd className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{g.text}</dd></div>
      <Button variant="ghost" size="icon" className="shrink-0" aria-label={`Edit ${g.title}`} onClick={() => onEdit(g.step)} disabled={submitting}><Pencil className="h-4 w-4" /></Button>
    </div>)}</dl>
    <p className="mt-5 text-base leading-relaxed text-muted-foreground">Auto World Approvals uses your vehicle, location, income-source and contact details to help authorized staff and appropriate dealer-finance partners respond to your inquiry. Your inquiry may be shared with participating dealers and financing partners for this purpose. This submission does not authorize a credit check; a partner must obtain appropriate separate authorization.</p>
    <p className="mt-3 text-base leading-relaxed text-muted-foreground">For help, partner details, access, correction, deletion or consent withdrawal requests, email <a href="mailto:admin@autoworldapprovals.com" className="break-words underline">admin@autoworldapprovals.com</a>. Read our <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</Link>, <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms</Link> and <Link to="/consent" target="_blank" rel="noopener noreferrer" className="underline">Application Consent</Link> (open in a new tab).</p>
    <div className="mt-5 space-y-5">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed"><Checkbox className="mt-1 h-6 w-6 shrink-0" aria-required="true" checked={acknowledged} onCheckedChange={(v) => update({ consent_contact: v === true, consent_accuracy: v === true, consent_not_guarantee: v === true })} disabled={submitting} /><span>I confirm my details are accurate, acknowledge this is not a financing approval, and agree to be contacted and have my inquiry shared as described above. <strong>(required)</strong></span></label>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed"><Checkbox className="mt-1 h-6 w-6 shrink-0" checked={data.consent_marketing === true} onCheckedChange={(v) => update({ consent_marketing: v === true })} disabled={submitting} /><span>Send me occasional vehicle offers and updates by email from Auto World Approvals. Optional; I can unsubscribe at any time.</span></label>
    </div>
    {errorMsg && <p role="alert" className="mt-5 text-sm text-destructive [overflow-wrap:anywhere]">{errorMsg}</p>}
    <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
      <Button variant="ghost" onClick={onBack} disabled={submitting} className="w-full sm:w-auto"><ArrowLeft className="h-4 w-4" />Back</Button>
      <Button size="lg" variant="hero" disabled={!acknowledged || submitting} onClick={() => onSubmit({})} className="h-auto min-h-12 w-full max-w-full px-4 py-3 sm:w-auto">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="min-w-0 [overflow-wrap:anywhere]">Saving your inquiry…</span></> : <><span className="min-w-0 [overflow-wrap:anywhere]">Submit my application</span><ArrowRight className="h-4 w-4" /></>}</Button>
    </div>
  </StepShell>;
}
