import { describe, expect, it } from "vitest";
import { safeFunnelParams, safePagePath, safeErrorReport, emailProviderFailure } from "./privacy-telemetry";
describe("confidential telemetry", () => {
  it("excludes financial and contact answers from analytics", () => { expect(safeFunnelParams({ step_number: 5, step_name: "income", form_variant: "A", income_amount: "8000", email: "private@example.com" })).toEqual({ step_number: 5, step_name: "income", form_variant: "A" }); });
  it("rejects answers disguised as allowed analytics values", () => { expect(safeFunnelParams({ step_name: "8000", error_code: "private@example.com", form_variant: "customer" })).toEqual({}); });
  it("excludes receipt identifiers and private paths", () => { expect(safePagePath("/thank-you?id=private-reference")).toBe("/thank-you"); expect(safePagePath("/admin/leads/private-reference")).toBe("/admin"); });
  it("withholds confidential exception details", () => { expect(safeErrorReport().message).toBe("Website operation failed; confidential error details withheld"); });
  it("records provider status only", () => { expect(emailProviderFailure(422)).toBe("Email provider HTTP 422"); });
});
