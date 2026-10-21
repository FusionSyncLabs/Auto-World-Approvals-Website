/** Maps CRM statuses to the spec's P2 outcome events (GA4 recommended names). */
export type CrmOutcome = "working_lead" | "qualify_lead" | "close_convert_lead";

export function crmOutcomeEvent(status: string): CrmOutcome | null {
  if (status === "contacted") return "working_lead";
  if (status === "qualified") return "qualify_lead";
  if (status === "sold" || status === "closed") return "close_convert_lead";
  return null;
}
