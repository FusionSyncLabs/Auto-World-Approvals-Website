import { describe, it, expect } from "vitest";
import { buildLeadEvent, canSendAdvertising, META_ELIGIBILITY_VERIFIED } from "./ad-policy";
import { isProductionHost } from "./prod-host";
const allowed = { production: true, accepted: true, currentAccepted: true, eligible: true };
describe("advertising safeguards", () => {
  it("blocks the unresolved dataset restrictions", () => expect(META_ELIGIBILITY_VERIFIED).toBe(false));
  it("blocks preview conversions", () => expect(canSendAdvertising({ ...allowed, production: isProductionHost("test.lovableproject.com") })).toBe(false));
  it("permits the exact production hosts only", () => { expect(isProductionHost("autoworldapprovals.com")).toBe(true); expect(isProductionHost("www.autoworldapprovals.com")).toBe(true); expect(isProductionHost("autoworldapprovals.com.attacker.example")).toBe(false); });
  it("requires event-time acceptance", () => expect(canSendAdvertising({ ...allowed, accepted: false })).toBe(false));
  it("honors withdrawal", () => expect(canSendAdvertising({ ...allowed, currentAccepted: false })).toBe(false));
  it("honors an opt-out", () => expect(canSendAdvertising({ ...allowed, optOut: true })).toBe(false));
  it("permits only the fully eligible accepted combination", () => expect(canSendAdvertising(allowed)).toBe(true));
  it("uses one stable Lead identifier for the saved application", () => expect(buildLeadEvent("123", "2026-10-18T12:00:00Z").event_id).toBe("lead_123"));
  it("uses the actual saved confirmation time", () => expect(buildLeadEvent("123", "2026-10-18T12:00:00Z").event_time).toBe(1792324800));
  it("never invents currency or value", () => { const event = buildLeadEvent("123", "2026-10-18T12:00:00Z"); expect(event).not.toHaveProperty("value"); expect(event).not.toHaveProperty("currency"); });
});