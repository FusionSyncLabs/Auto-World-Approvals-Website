// Shared lead scoring used by every intake path (website funnel, trade-in form,
// sheet webhook, manual admin entry). Mirrors public.compute_lead_score() in SQL.

export type ScorableLead = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

export function computeLeadScore(l: ScorableLead): number {
  let s = 0;
  // Contact block: a name + phone + email and nothing else tops out at 25.
  if (str(l.first_name) && str(l.phone)) s += 15;
  if (str(l.last_name)) s += 3;
  if (str(l.email)) s += 7;

  // Qualifying details beyond contact info.
  let q = 0;
  if (str(l.city) || str(l.province) || str(l.postal_code)) q += 5;
  if (str(l.vehicle_type)) q += 8;
  if (str(l.monthly_budget)) q += 7;
  if (str(l.credit_rating)) q += 10;
  if (str(l.employment_status) || str(l.income_amount)) q += 10;
  if (str(l.has_trade_in) || str(l.employment_length)) q += 5;
  if (str(l.residence_status)) q += 5;
  if (str(l.has_drivers_licence) || str(l.date_of_birth) || str(l.street_address)) q += 5;
  if (l.consent_credit_check === true) q += 5;
  s += q;

  // Submission bonus only applies when they gave us more than contact details.
  const status = str(l.status);
  if (
    q > 0 &&
    (l.submitted_at ||
      ["new", "submitted", "contacted", "qualified", "sent_to_dealer", "approved", "sold"].includes(status))
  ) {
    s += 10;
  }
  return Math.max(0, Math.min(100, s));
}

export type ScoreBand = "low" | "cold" | "warm" | "hot";

export function scoreBand(score: number): ScoreBand {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  if (score > 25) return "cold";
  return "low";
}

export function scoreEmoji(score: number): string {
  const b = scoreBand(score);
  return b === "hot" ? "😀" : b === "warm" ? "🙂" : b === "cold" ? "😐" : "🙁";
}

/** Tailwind classes for the score chip. */
export function scoreChipClass(score: number): string {
  const b = scoreBand(score);
  if (b === "hot") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (b === "warm") return "bg-amber-100 text-amber-900 border-amber-300";
  if (b === "cold") return "bg-orange-100 text-orange-800 border-orange-300";
  return "bg-red-100 text-red-800 border-red-300";
}

