import { describe, expect, it } from "vitest";
import { assignmentForEmail } from "./lead-assignment";

describe("delivered lead ownership", () => {
  it("uses the confirmed assigned recipient and distribution list", () => {
    expect(assignmentForEmail({ name: "Mike", email: "mike@example.com" }, "BC")).toEqual({
      assignedToName: "Mike", assignedToEmail: "mike@example.com", assignedListName: "BC",
    });
  });
  it("does not invent an owner from a copy recipient when no assignment exists", () => {
    expect(assignmentForEmail(null, "BC")).toEqual({ assignedToName: null, assignedToEmail: null, assignedListName: null });
  });
});