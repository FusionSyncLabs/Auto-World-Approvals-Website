import { describe, expect, it } from "vitest";
import { isNameInput, PersonNameSchema } from "./name-validation";

describe("English-only personal names", () => {
  it("rejects all-number and mixed-number names", () => {
    for (const name of ["123456", "John2"]) expect(PersonNameSchema.safeParse(name).success).toBe(false);
  });
  it("rejects special characters", () => {
    for (const name of ["O'Neil", "Anne-Marie", "John@", "Jane😀", "Jane\nDoe"]) expect(PersonNameSchema.safeParse(name).success).toBe(false);
  });
  it("rejects accented letters and non-English scripts", () => {
    for (const name of ["José", "Zoë", "Иван", "李", "محمد"]) expect(PersonNameSchema.safeParse(name).success).toBe(false);
  });
  it("accepts English letters and spaces", () => {
    for (const name of ["John", "Mary Jane", "van der Meer"]) expect(PersonNameSchema.safeParse(name).success).toBe(true);
  });
  it("rejects blank required names", () => {
    for (const name of ["", "   "]) expect(PersonNameSchema.safeParse(name).success).toBe(false);
  });
  it("blocks invalid typed and pasted edits without changing the name", () => {
    expect(isNameInput("John123")).toBe(false);
    expect(isNameInput("李")).toBe(false);
    expect(isNameInput("John ")).toBe(true);
    expect(isNameInput("")).toBe(true);
  });
});