import { z } from "zod";

export const NAME_PATTERN = "[A-Za-z ]+";
export const NAME_ERROR = "Use English letters (A–Z) and spaces only; no numbers or special characters.";
export const isNameInput = (value: string) => /^[A-Za-z ]*$/.test(value);
export const PersonNameSchema = z.string().regex(/^[A-Za-z ]*$/, NAME_ERROR).trim().min(1, "Enter a name").max(100).regex(/^[A-Za-z]+(?: +[A-Za-z]+)*$/, NAME_ERROR);
export const OptionalPersonNameSchema = PersonNameSchema.or(z.literal("")).optional();