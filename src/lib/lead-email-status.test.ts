import { expect, it } from "vitest";
import { isPartialEmailLead } from "./lead-email-status";

it("Facebook form with a submission timestamp and 20% completion is still partial", () => {
  expect(isPartialEmailLead({ status: "partial", completion_pct: 20, current_step: "sheet_import", submitted_at: "2026-10-19T00:54:56Z" })).toBe(true);
});
it("contacted imports are still partial rather than completed applications", () => {
  expect(isPartialEmailLead({ status: "contacted", completion_pct: 20, current_step: "sheet_import" })).toBe(true);
});
it("a completed website intake is not partial", () => {
  expect(isPartialEmailLead({ status: "new", completion_pct: 100, current_step: "submitted" })).toBe(false);
});