import { describe, it, expect } from "vitest";
import { crmOutcomeEvent } from "./crm-outcomes";

describe("crmOutcomeEvent", () => {
  it("contacted is a working lead", () => expect(crmOutcomeEvent("contacted")).toBe("working_lead"));
  it("qualified is a qualified lead", () => expect(crmOutcomeEvent("qualified")).toBe("qualify_lead"));
  it("sold and closed are conversions", () => {
    expect(crmOutcomeEvent("sold")).toBe("close_convert_lead");
    expect(crmOutcomeEvent("closed")).toBe("close_convert_lead");
  });
  it("attempts and not proceeding are not outcomes", () => {
    expect(crmOutcomeEvent("contact_attempted")).toBeNull();
    expect(crmOutcomeEvent("not_proceeding")).toBeNull();
  });
});
