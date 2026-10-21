export type StepId =
  | "vehicle_type"
  | "monthly_budget"
  | "employment_status"
  | "industry"
  | "employment_details"
  | "income"
  | "additional_income"
  | "employment_length"
  | "address_details"
  | "searching"
  | "qualified"
  | "residence_status"
  | "address_length"
  | "street_address"
  | "date_of_birth"
  | "name"
  | "mobile"
  | "contact"
  | "review"
  | "thank_you"
  | "not_qualified";

export interface ChoiceOption { value: string; label: string; description?: string }

export const VEHICLE_TYPES: ChoiceOption[] = [
  { value: "car", label: "Car" },
  { value: "suv", label: "SUV / Crossover" },
  { value: "truck", label: "Truck" },
  { value: "van", label: "Van" },
  { value: "ev_hybrid", label: "Electric / Hybrid" },
  { value: "not_sure", label: "Not sure yet" },
];

export const BUDGETS: ChoiceOption[] = [
  { value: "under_400", label: "Under $400 / month" },
  { value: "400_499", label: "$400 – $499 / month" },
  { value: "500_600", label: "$500 – $600 / month" },
  { value: "over_600", label: "Over $600 / month" },
  { value: "not_sure", label: "Not sure — just exploring", description: "Totally fine — we'll show you what fits" },
];

export const YES_NO: ChoiceOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const VEHICLE_CONDITIONS: ChoiceOption[] = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
  { value: "not_sure", label: "Either / not sure" },
];

export const PURCHASE_TIMELINES: ChoiceOption[] = [
  { value: "asap", label: "As soon as practical" },
  { value: "within_month", label: "Within a month" },
  { value: "one_to_three_months", label: "In 1–3 months" },
  { value: "just_exploring", label: "Just exploring" },
];

export const DOWN_PAYMENTS: ChoiceOption[] = [
  { value: "0", label: "$0" },
  { value: "500_999", label: "$500 – $999" },
  { value: "1000_2499", label: "$1,000 – $2,499" },
  { value: "2500_4999", label: "$2,500 – $4,999" },
  { value: "5000_plus", label: "$5,000+" },
  { value: "not_sure", label: "Not sure" },
];

export const TRADE_IN: ChoiceOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Unsure" },
];

export const CREDIT_RATINGS: ChoiceOption[] = [
  { value: "poor", label: "Poor", description: "300 – 599" },
  { value: "fair", label: "Fair", description: "600 – 659" },
  { value: "good", label: "Good", description: "660 – 724" },
  { value: "very_good", label: "Very Good", description: "725 – 759" },
  { value: "excellent", label: "Excellent", description: "760 – 900" },
  { value: "unknown", label: "No Credit / Unsure" },
];

export const EMPLOYMENT: ChoiceOption[] = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "student", label: "Student" },
  { value: "other", label: "Other" },
];

/** Income situations our lending partners cannot currently approve (owner decision 2026-10-20). The intake ends politely without saving an application. */
export const NON_QUALIFYING_EMPLOYMENT = new Set(["unemployed", "benefits", "retired"]);

export const PAY_FREQUENCIES: ChoiceOption[] = [
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-weekly" },
  { value: "semi_monthly", label: "Twice a month" },
  { value: "monthly", label: "Monthly" },
];

export const INCOME_TYPES: ChoiceOption[] = [
  { value: "annual", label: "Annual salary" },
  { value: "hourly", label: "Hourly wage" },
  { value: "monthly", label: "Monthly income" },
  { value: "other", label: "Other" },
];

/** Tap-friendly industry buckets — replaces free-text employer questions. */
export const INDUSTRIES: ChoiceOption[] = [
  { value: "Trades & construction", label: "Trades & construction" },
  { value: "Transportation & logistics", label: "Transportation & logistics" },
  { value: "Healthcare & care work", label: "Healthcare & care work" },
  { value: "Retail, food & hospitality", label: "Retail, food & hospitality" },
  { value: "Office, sales & admin", label: "Office, sales & admin" },
  { value: "Oil, gas & mining", label: "Oil, gas & mining" },
  { value: "Manufacturing & warehouse", label: "Manufacturing & warehouse" },
  { value: "Education & government", label: "Education & government" },
  { value: "Other", label: "Something else" },
];

/** Income brackets shown as one-tap ranges, scaled to the pay frequency. */
export function incomeRanges(frequency?: string): ChoiceOption[] {
  const make = (labels: string[]) => labels.map((l) => ({ value: l, label: l }));
  if (frequency === "weekly") {
    return make(["Under $500", "$500 – $749", "$750 – $999", "$1,000 – $1,499", "$1,500+"]);
  }
  if (frequency === "monthly") {
    return make(["Under $2,000", "$2,000 – $2,999", "$3,000 – $3,999", "$4,000 – $5,999", "$6,000+"]);
  }
  // Bi-weekly / twice a month
  return make(["Under $1,000", "$1,000 – $1,499", "$1,500 – $1,999", "$2,000 – $2,999", "$3,000+"]);
}

export const TIME_LENGTHS: ChoiceOption[] = [
  { value: "lt_3_months", label: "Less than 3 months" },
  { value: "3_months", label: "3+ months" },
  { value: "9_months", label: "9+ months" },
  { value: "1_year", label: "1+ year" },
  { value: "3_years", label: "3+ years" },
  { value: "5_years", label: "5+ years" },
  { value: "10_years", label: "10+ years" },
];

export const RESIDENCE: ChoiceOption[] = [
  { value: "own", label: "I own my home" },
  { value: "rent", label: "I rent" },
  { value: "family", label: "I live with family" },
  { value: "other", label: "Other" },
];

export const PROVINCES: ChoiceOption[] = [
  { value: "BC", label: "British Columbia" },
  { value: "AB", label: "Alberta" },
  { value: "SK", label: "Saskatchewan" },
  { value: "MB", label: "Manitoba" },
  { value: "ON", label: "Ontario" },
  { value: "QC", label: "Quebec" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "YT", label: "Yukon" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
];

export const CONTACT_METHODS: ChoiceOption[] = [
  { value: "phone", label: "Phone" },
  { value: "text", label: "Text Message" },
  { value: "email", label: "Email" },
];

export interface FunnelData {
  vehicle_type?: string;
  vehicle_condition?: string;
  purchase_timeline?: string;
  monthly_budget?: string;
  down_payment?: string;
  has_trade_in?: string;
  trade_in_year?: string; trade_in_make?: string; trade_in_model?: string; trade_in_trim?: string;
  trade_in_mileage?: string; trade_in_loan_owing?: string; trade_in_amount_owing?: string; trade_in_condition?: string;
  credit_rating?: string;
  employment_status?: string;
  income_type?: string;
  pay_frequency?: string;
  income_amount?: string;
  income_years?: string; income_months?: string;
  employment_length?: string;
  additional_income?: string; additional_income_source?: string; additional_income_amount?: string;
  employer_name?: string; job_title?: string; employer_phone?: string; industry?: string;
  business_name?: string; business_type?: string; years_in_business?: string;
  residence_status?: string;
  monthly_housing_payment?: string;
  address_length?: string;
  address_years?: string; address_months?: string;
  street_address?: string; city?: string; province?: string; postal_code?: string;
  prev_street_address?: string; prev_city?: string; prev_province?: string; prev_postal_code?: string;
  first_name?: string; last_name?: string; date_of_birth?: string; email?: string; phone?: string;
  preferred_contact?: string;
  has_drivers_licence?: string; licence_class?: string;
  consent_accuracy?: boolean; consent_contact?: boolean; consent_credit_check?: boolean;
  consent_not_guarantee?: boolean; consent_marketing?: boolean;
}

/** Employment situations where we ask for job / employer detail. */
const WORKING = new Set(["employed", "self_employed"]);

/** A/B split test: "A" asks budget first, "B" asks it after work & income. */
export type FunnelVariant = "A" | "B";

export function getSteps(d: FunnelData, askVehicle = !d.vehicle_type, variant: FunnelVariant = "A"): StepId[] {
  void askVehicle;
  void variant;
  const steps: StepId[] = ["vehicle_type", "monthly_budget", "employment_status", "income"];
  if (WORKING.has(d.employment_status || "")) steps.push("employment_length");
  steps.push("address_details", "street_address", "date_of_birth", "contact", "review");
  return steps;
}

export function computeLeadScore(d: FunnelData): number {
  let s = 0;
  if (d.first_name && d.phone) s += 20;
  if (d.email) s += 5;
  if (d.province === "BC" || d.province === "AB") s += 10;
  if (["500_600", "over_600"].includes(d.monthly_budget || "")) s += 10;
  else if (d.monthly_budget) s += 5;
  if (WORKING.has(d.employment_status || "")) s += 15;
  else if (d.employment_status) s += 5;
  if (d.income_amount) s += 10;
  if (["1_year", "3_years", "5_years", "10_years"].includes(d.employment_length || "")) s += 5;
  if (d.street_address && d.postal_code) s += 10;
  if (d.date_of_birth) s += 5;
  if (d.residence_status === "own") s += 5;
  return Math.min(s, 100);
}
