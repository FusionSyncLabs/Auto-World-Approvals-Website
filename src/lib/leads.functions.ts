import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { PersonNameSchema } from "@/lib/name-validation";
import { isProductionHost, hostFromHeader } from "./prod-host";
import { phoneError, isBlockedRegion, EASTERN_REGION_MESSAGE } from "@/lib/phone";

// Allowlist of fields the client may submit. Anything not listed is dropped.
const LeadDataSchema = z
  .object({
    first_name: PersonNameSchema,
    last_name: PersonNameSchema,
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().max(40).optional(),
    date_of_birth: z.string().trim().max(40).optional(),

    province: z.string().trim().max(40).optional(),
    city: z.string().trim().max(120).optional(),
    postal_code: z.string().trim().max(20).optional(),
    address: z.string().trim().max(255).optional(),
    street_address: z.string().trim().max(255).optional(),
    prev_street_address: z.string().trim().max(255).optional(),
    prev_city: z.string().trim().max(120).optional(),
    prev_province: z.string().trim().max(40).optional(),
    prev_postal_code: z.string().trim().max(20).optional(),
    address_years: z.string().trim().max(10).optional(),
    address_months: z.string().trim().max(10).optional(),

    vehicle_type: z.string().trim().max(40).optional(),
    vehicle_use: z.string().trim().max(40).optional(),
    monthly_budget: z.string().trim().max(40).optional(),
    down_payment: z.string().trim().max(40).optional(),

    has_trade_in: z.string().trim().max(20).optional(),
    trade_in_year: z.string().trim().max(10).optional(),
    trade_in_make: z.string().trim().max(80).optional(),
    trade_in_model: z.string().trim().max(80).optional(),
    trade_in_trim: z.string().trim().max(80).optional(),
    trade_in_mileage: z.string().trim().max(20).optional(),
    trade_in_loan_owing: z.string().trim().max(20).optional(),
    trade_in_amount_owing: z.string().trim().max(20).optional(),
    trade_in_condition: z.string().trim().max(40).optional(),

    credit_rating: z.string().trim().max(40).optional(),
    employment_status: z.string().trim().max(40).optional(),
    income_type: z.string().trim().max(40).optional(),
    income_amount: z.string().trim().max(20).optional(),
    income_years: z.string().trim().max(10).optional(),
    income_months: z.string().trim().max(10).optional(),
    monthly_income: z.string().trim().max(20).optional(),
    employer_name: z.string().trim().max(160).optional(),
    job_title: z.string().trim().max(160).optional(),
    employer_phone: z.string().trim().max(40).optional(),
    industry: z.string().trim().max(120).optional(),
    business_name: z.string().trim().max(160).optional(),
    business_type: z.string().trim().max(120).optional(),
    years_in_business: z.string().trim().max(10).optional(),
    time_at_employer: z.string().trim().max(40).optional(),

    residence_status: z.string().trim().max(40).optional(),
    housing_status: z.string().trim().max(40).optional(),
    monthly_housing_payment: z.string().trim().max(20).optional(),
    time_at_address: z.string().trim().max(40).optional(),

    preferred_contact: z.string().trim().max(40).optional(),
    has_drivers_licence: z.string().trim().max(20).optional(),
    licence_class: z.string().trim().max(20).optional(),

    consent_accuracy: z.boolean().optional(),
    consent_contact: z.boolean().optional(),
    consent_credit_check: z.boolean().optional(),
    consent_not_guarantee: z.boolean().optional(),
    consent_marketing: z.boolean().optional(),
  })
  .strict();

type LeadData = z.infer<typeof LeadDataSchema>;

const TrackingSchema = z
  .object({
    utm_source: z.string().max(120).optional(),
    utm_medium: z.string().max(120).optional(),
    utm_campaign: z.string().max(120).optional(),
    utm_term: z.string().max(120).optional(),
    utm_content: z.string().max(120).optional(),
    gclid: z.string().max(255).optional(),
    fbclid: z.string().max(255).optional(),
    msclkid: z.string().max(255).optional(),
    channel: z.string().max(120).optional(),
    device: z.string().max(40).optional(),
    referrer: z.string().max(500).optional(),
    landing_page: z.string().max(500).optional(),
  })
  .partial();

const SubmitSchema = z.object({
  data: LeadDataSchema,
  source: z.string().max(80).optional(),
  tracking: TrackingSchema.optional(),
});

export interface SubmitLeadInput {
  data: LeadData;
  source?: string;
  tracking?: Record<string, string | undefined>;
}

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((input: SubmitLeadInput) => {
    const parsed = SubmitSchema.parse(input);
    const err = phoneError(parsed.data.phone ?? "");
    if (err) throw new Error(err);
    if (isBlockedRegion(parsed.data.province, parsed.data.postal_code)) throw new Error(EASTERN_REGION_MESSAGE);
    return parsed;
  })
  .handler(async ({ data: input }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyLeadSubmission } = await import("./leads-notify.server");
    const { computeLeadScore } = await import("./lead-score");

    const ip = getRequestIP({ xForwardedFor: true }) || null;
    const userAgent = getRequestHeader("user-agent") || null;

    const score = computeLeadScore({ ...input.data, submitted_at: new Date().toISOString() });

    const isTest = !isProductionHost(hostFromHeader(getRequestHeader("origin") || getRequestHeader("referer") || getRequestHeader("host")));
    const row: Record<string, unknown> = {
      is_test: isTest,
      ...input.data,
      lead_score: score,
      source: input.source || "website",
      ...(() => {
        const { channel, ...rest } = input.tracking || {};
        return channel ? { ...rest, attribution_channel: channel } : rest;
      })(),
      ip_address: ip,
      consent_ip: ip,
      consent_user_agent: userAgent,
      consent_timestamp: new Date().toISOString(),
      consent_policy_version: "1.0",
    };

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      console.error("submitLead error", error);
      throw new Error("Could not save your application. Please try again.");
    }

    if (isTest) return { id: lead.id, event_id: `lead_${lead.id}`, duplicate: false, is_test: true };

    const isDuplicate = Boolean((lead as { duplicate_of?: string | null }).duplicate_of);
    if (isDuplicate) {
      return {
        id: (lead as { id: string }).id,
        event_id: `lead_${(lead as { duplicate_of: string }).duplicate_of}`,
        duplicate: true,
      };
    }

    const eventId = `lead_${(lead as { id: string }).id}`;

    try {
      await notifyLeadSubmission(lead as Record<string, unknown>, eventId, ip, userAgent, { force: true, skipCapi: true });
      await supabaseAdmin
        .from("leads")
        .update({ email_notified_at: new Date().toISOString() } as never)
        .eq("id", (lead as { id: string }).id);
    } catch (e) {
      console.error("notify error", e);
    }

    // Automatic delivery to the saved delivery contacts (applicant info only).
    try {
      const { autoDeliverLead } = await import("./lead-delivery.server");
      await autoDeliverLead(lead as Record<string, unknown>);
    } catch (e) {
      console.error("auto-deliver error", e);
    }


    return { id: (lead as { id: string }).id, event_id: eventId };
  });
