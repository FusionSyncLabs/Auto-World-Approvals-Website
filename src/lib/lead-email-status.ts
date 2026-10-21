/** Submission timestamps on imported Facebook forms do not prove full intake completion. */
export function isPartialEmailLead(lead: Record<string, unknown>): boolean {
  return lead.status === "partial" || lead.status === "draft" ||
    lead.current_step === "sheet_import" || Number(lead.completion_pct ?? 0) < 100;
}

export function leadEmailTitle(lead: Record<string, unknown>): string {
  return isPartialEmailLead(lead) ? "New partial lead" : "New completed application";
}