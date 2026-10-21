import { z } from "zod";
import { PersonNameSchema } from "@/lib/name-validation";
import { phoneError, areaCode, isBlockedRegion, EASTERN_REGION_MESSAGE } from "@/lib/phone";
import { VEHICLE_TYPES, VEHICLE_CONDITIONS, BUDGETS, DOWN_PAYMENTS, TRADE_IN, PURCHASE_TIMELINES, EMPLOYMENT, PAY_FREQUENCIES, TIME_LENGTHS, PROVINCES, incomeRanges, type ChoiceOption } from "./schema";

export const INTAKE_CONSENT_VERSION = "intake-2026-10-v2";
const option = (choices: ChoiceOption[], message: string) => z.string().refine((v) => choices.some((o) => o.value === v), message);
const optionalOption = (choices: ChoiceOption[]) => option(choices, "Choose one of the available options").optional();
const CANADIAN_AREA_CODES = new Set("204 226 236 249 250 257 263 289 306 343 354 365 367 368 382 403 416 418 428 431 437 438 450 468 474 506 514 519 548 579 581 584 587 604 613 639 647 672 683 705 709 742 753 778 780 782 807 819 825 867 873 879 902 905 942".split(" "));
export function canadianPhoneError(phone: string): string | null {
  const issue = phoneError(phone);
  if (issue) return issue;
  return CANADIAN_AREA_CODES.has(areaCode(phone)) ? null : "Please enter a Canadian phone number.";
}

export const VehicleSchema = z.object({
  vehicle_type: option(VEHICLE_TYPES, "Choose a vehicle type, or Not sure yet"),
  vehicle_condition: optionalOption(VEHICLE_CONDITIONS),
});
export const BudgetSchema = z.object({
  monthly_budget: option(BUDGETS, "Choose a payment preference, or Not sure"),
  down_payment: optionalOption(DOWN_PAYMENTS),
  has_trade_in: optionalOption(TRADE_IN),
});
export const LocationSchema = z.object({
  province: option(PROVINCES, "Select your province or territory"),
  city: z.string().trim().min(1, "Enter your city").max(120),
  postal_code: z.string().trim().max(7).optional(),
  purchase_timeline: option(PURCHASE_TIMELINES, "Choose a purchase timeline"),
}).superRefine((d, ctx) => {
  if (d.postal_code && !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ] ?\d[ABCEGHJ-NPRSTVWXYZ]\d$/i.test(d.postal_code)) ctx.addIssue({ code: "custom", path: ["postal_code"], message: "Enter a valid Canadian postal code" });
  if (isBlockedRegion(d.province, d.postal_code)) ctx.addIssue({ code: "custom", path: ["province"], message: EASTERN_REGION_MESSAGE });
});
export const EmploymentSchema = z.object({ employment_status: option(EMPLOYMENT, "Select your employment or income source") });
export const IncomeSchema = z.object({
  pay_frequency: option(PAY_FREQUENCIES, "Choose how often you receive income"),
  income_amount: z.string().max(60),
}).superRefine((d, ctx) => {
  if (!incomeRanges(d.pay_frequency).some((o) => o.value === d.income_amount)) ctx.addIssue({ code: "custom", path: ["income_amount"], message: "Choose a gross income range for this frequency" });
});
export const ContactSchema = z.object({
  first_name: PersonNameSchema,
  last_name: PersonNameSchema,
  phone: z.string().trim().max(40).superRefine((v, ctx) => { const error = canadianPhoneError(v); if (error) ctx.addIssue({ code: "custom", message: error }); }),
  email: z.string().trim().email("Enter a valid email address").max(255),
  preferred_contact: z.enum(["phone", "email"]).optional(),
});
export const StreetAddressSchema = z.object({
  street_address: z.string().trim().min(1, "Enter your street address").max(255, "Enter a shorter street address"),
});
export function dateOfBirthError(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "Enter your date of birth";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return "Enter a valid date of birth";
  const today = new Date();
  const max = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const min = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
  if (date > max) return "You must be at least 18 years old to apply";
  if (date < min) return "Enter a valid date of birth";
  return null;
}
export const DateOfBirthSchema = z.object({
  date_of_birth: z.string().trim().superRefine((v, ctx) => { const error = dateOfBirthError(v); if (error) ctx.addIssue({ code: "custom", message: error }); }),
});
export const AcknowledgementSchema = z.object({
  consent_accuracy: z.literal(true, { errorMap: () => ({ message: "Please confirm the application acknowledgement" }) }),
  consent_contact: z.literal(true),
  consent_not_guarantee: z.literal(true),
  consent_marketing: z.boolean().default(false),
});
export const IntakeAnswersSchema = VehicleSchema.merge(BudgetSchema).merge(EmploymentSchema)
  .merge(IncomeSchema.innerType()).merge(ContactSchema).merge(StreetAddressSchema).extend({
    province: z.string(), city: z.string().trim().max(120).optional(), postal_code: z.string().trim().max(7).optional(),
    purchase_timeline: z.string(), employment_length: optionalOption(TIME_LENGTHS),
    date_of_birth: DateOfBirthSchema.shape.date_of_birth,
  }).strict().superRefine((d, ctx) => {
    for (const schema of [LocationSchema, IncomeSchema]) {
      const result = schema.safeParse(d);
      if (!result.success) for (const issue of result.error.issues) ctx.addIssue(issue);
    }
    if (["employed", "self_employed"].includes(d.employment_status) && !d.employment_length) ctx.addIssue({ code: "custom", path: ["employment_length"], message: "Choose your employment tenure" });
  });
export const IntakeSubmissionSchema = z.object({
  idempotency_key: z.string().uuid(),
  answers: IntakeAnswersSchema,
  consents: AcknowledgementSchema,
  advertising_consent_id: z.string().uuid().optional(),
  ad_consent: z.boolean().optional(),
  tracking: z.object({
    utm_source: z.string().max(120).optional(), utm_medium: z.string().max(120).optional(),
    utm_campaign: z.string().max(120).optional(), utm_term: z.string().max(120).optional(), utm_content: z.string().max(120).optional(),
    gclid: z.string().max(255).optional(), fbclid: z.string().max(255).optional(), msclkid: z.string().max(255).optional(),
    channel: z.string().max(120).optional(), device: z.string().max(40).optional(),
    referrer: z.string().max(500).optional(), landing_page: z.string().max(500).optional(),
    funnel_variant: z.enum(["A", "B"]).optional(),
  }).strict().optional(),
}).strict();