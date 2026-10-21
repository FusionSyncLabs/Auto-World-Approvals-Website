/** Do not bypass the financing dataset restriction notice. Enable only after documented review. */
export const META_ELIGIBILITY_VERIFIED = false;
export const AD_NOTICE_VERSION = "2026-10-19";
export const AD_NOTICE_TEXT = "Optional analytics shares usage events with Google Analytics. Optional advertising, when eligible, shares page activity and completed-application events with Meta and Google for measurement and ad optimization. We do not share application answers or contact details for ad matching. Rejecting does not affect your application. Withdraw in Cookie preferences. Choices and this notice version are recorded; prior acceptance evidence is retained after withdrawal.";
export function canSendAdvertising(input: { production: boolean; accepted: boolean; currentAccepted: boolean; eligible: boolean; optOut?: boolean }): boolean {
  return input.production && input.accepted && input.currentAccepted && input.eligible && !input.optOut;
}
export function leadEventId(id: string): string { return `lead_${id}`; }
export function buildLeadEvent(id: string, submittedAt: string) {
  return { event_name: "Lead" as const, event_id: leadEventId(id), event_time: Math.floor(new Date(submittedAt).getTime() / 1000), action_source: "website" as const, event_source_url: "https://autoworldapprovals.com/apply" };
}