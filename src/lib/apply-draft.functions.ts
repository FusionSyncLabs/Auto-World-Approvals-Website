import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { PersonNameSchema, OptionalPersonNameSchema } from "@/lib/name-validation";
import { phoneError, isValidNanpNumber, normalizePhone } from "@/lib/phone";
import { isProductionHost, hostFromHeader } from "@/lib/prod-host";


// Fields users may write into a draft. Kept in sync with the leads columns
// used by the apply funnel. Sensitive columns (score, consent metadata, IP)
// are computed server-side.
const DraftPatchSchema = z
  .object({
    first_name: OptionalPersonNameSchema,
    last_name: OptionalPersonNameSchema,
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().max(40).optional(),
    date_of_birth: z.string().trim().max(40).optional(),

    province: z.string().trim().max(40).optional(),
    city: z.string().trim().max(120).optional(),
    postal_code: z.string().trim().max(20).optional(),
    street_address: z.string().trim().max(255).optional(),

    vehicle_type: z.string().trim().max(40).optional(),
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
    employer_name: z.string().trim().max(160).optional(),
    job_title: z.string().trim().max(160).optional(),
    employer_phone: z.string().trim().max(40).optional(),
    industry: z.string().trim().max(120).optional(),
    business_name: z.string().trim().max(160).optional(),
    business_type: z.string().trim().max(120).optional(),
    years_in_business: z.string().trim().max(10).optional(),

    residence_status: z.string().trim().max(40).optional(),
    pay_frequency: z.string().trim().max(40).optional(),
    employment_length: z.string().trim().max(40).optional(),
    address_length: z.string().trim().max(40).optional(),
    additional_income: z.string().trim().max(20).optional(),
    additional_income_source: z.string().trim().max(120).optional(),
    additional_income_amount: z.string().trim().max(20).optional(),

    monthly_housing_payment: z.string().trim().max(20).optional(),

    preferred_contact: z.string().trim().max(40).optional(),
    has_drivers_licence: z.string().trim().max(20).optional(),
    licence_class: z.string().trim().max(20).optional(),
  })
  .strict();

export type DraftPatch = z.infer<typeof DraftPatchSchema>;

const StartSchema = z.object({
  first_name: PersonNameSchema,
  last_name: OptionalPersonNameSchema,
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(40)
    .superRefine((v, ctx) => {
      const err = phoneError(v);
      if (err) ctx.addIssue({ code: "custom", message: err });
    }),

  vehicle_type: z.string().trim().max(40).optional(),
  monthly_budget: z.string().trim().max(40).optional(),
  tracking: z
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
      referrer: z.string().max(500).optional(),
      landing_page: z.string().max(500).optional(),
      device: z.string().max(40).optional(),
    funnel_variant: z.enum(["A", "B"]).optional(),
    })
    .partial()
    .optional(),
});


export const startDraft = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof StartSchema>) => StartSchema.parse(input))
  .handler(async () => {
    throw new Error("Draft capture is retired. Please use the current application at /apply; it saves only after review and submission.");
  });

const SaveSchema = z.object({
  resume_token: z.string().uuid(),
  patch: DraftPatchSchema,
  current_step: z.string().max(60).optional(),
  completion_pct: z.number().int().min(0).max(100).optional(),
});

export const saveDraftField = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof SaveSchema>) => SaveSchema.parse(input))
  .handler(async () => {
    throw new Error("Draft capture is retired. Please use the current application at /apply; it saves only after review and submission.");
  });


export const getDraft = createServerFn({ method: "POST" })
  .inputValidator((i: { resume_token: string }) =>
    z.object({ resume_token: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data: input }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("resume_token", input.resume_token)
      .maybeSingle();
    if (!data) return null;
    if (data.submitted_at || !["partial", "draft", "contacted"].includes(data.status)) {
      // Already submitted — don't re-open the funnel.
      return { submitted: true as const, id: data.id as string };
    }
    return { submitted: false as const, data };
  });

const SubmitSchema = z.object({
  resume_token: z.string().uuid(),
  patch: DraftPatchSchema.optional(),
  consents: z
    .object({
      consent_accuracy: z.boolean().optional(),
      consent_credit_check: z.boolean().optional(),
      consent_not_guarantee: z.boolean().optional(),
      consent_marketing: z.boolean().optional(),
    })
    .optional(),
  ad_consent: z.boolean().optional(),
  advertising_consent_id: z.string().uuid().optional(),
});

export const submitDraft = createServerFn({ method: "POST" })
  .inputValidator((i: z.infer<typeof SubmitSchema>) => SubmitSchema.parse(i))
  .handler(async ({ data: input }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const ip = getRequestIP({ xForwardedFor: true }) || null;
    const userAgent = getRequestHeader("user-agent") || null;

    const { phone: submitPhone, ...restSubmitPatch } = input.patch ?? {};
    const update: Record<string, unknown> = {
      ...restSubmitPatch,
      ...(isValidNanpNumber(submitPhone ?? "") ? { phone: normalizePhone(submitPhone ?? "") } : {}),
      ...(input.consents ?? {}),
      status: "new",
      submitted_at: now,
      last_activity_at: now,
      completion_pct: 100,
      current_step: "submitted",
      consent_timestamp: now,
      consent_ip: ip,
      consent_user_agent: userAgent,
    };

    const { data: currentLead } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("resume_token", input.resume_token)
      .maybeSingle();

    // An application can only be submitted with a callable BC/AB phone number.
    const finalPhone = (update.phone as string | undefined) ?? (currentLead?.phone as string | null) ?? "";
    const finalPhoneError = phoneError(finalPhone);
    if (finalPhoneError) throw new Error(finalPhoneError);

    const { isBlockedRegion, EASTERN_REGION_MESSAGE } = await import("@/lib/phone");
    const finalProvince = (update.province as string | undefined) ?? (currentLead?.province as string | null) ?? "";
    const finalPostal = (update.postal_code as string | undefined) ?? (currentLead?.postal_code as string | null) ?? "";
    if (isBlockedRegion(finalProvince, finalPostal)) throw new Error(EASTERN_REGION_MESSAGE);

    // A valid email is also required to submit.
    const finalEmail = String(
      (update.email as string | undefined) ?? (currentLead?.email as string | null) ?? "",
    ).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
      throw new Error("Please add a valid email address so we can send your pre-approval details.");
    }

    // Idempotency: a retry, double tap or reload of an already-submitted
    // application returns the original result and re-sends nothing.
    if (currentLead?.submitted_at) {
      const dupOf = (currentLead as { duplicate_of?: string | null }).duplicate_of;
      return {
        id: currentLead.id as string,
        event_id: `lead_${dupOf || currentLead.id}`,
        duplicate: true,
        is_test: Boolean((currentLead as { is_test?: boolean }).is_test),
      };
    }

    // Validate merged legacy answers before saving or sending a conversion.
    PersonNameSchema.parse(update.first_name ?? currentLead?.first_name);
    PersonNameSchema.parse(update.last_name ?? currentLead?.last_name);

    // Preview / test hostnames never create real deliveries or conversions.
    const { isProductionHost, hostFromHeader } = await import("@/lib/prod-host");
    const reqHost = hostFromHeader(getRequestHeader("origin") || getRequestHeader("referer") || getRequestHeader("host"));
    const isTest = !isProductionHost(reqHost) || Boolean(currentLead?.is_test);
    if (isTest) update.is_test = true;
    update.advertising_consent_id = input.advertising_consent_id ?? null;

    if (currentLead) {
      const { computeLeadScore } = await import("./lead-score");
      update.lead_score = computeLeadScore({ ...(currentLead as Record<string, unknown>), ...update });
      if (currentLead.status === "contacted") update.status = "contacted";
    }


    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .update(update as never)
      .eq("resume_token", input.resume_token)
      .is("submitted_at", null)
      .select("*")
      .maybeSingle();
    if (!error && !lead) {
      const { data: alreadySaved } = await supabaseAdmin.from("leads").select("id,submitted_at,duplicate_of,is_test").eq("resume_token", input.resume_token).maybeSingle();
      if (alreadySaved?.submitted_at) return { id: alreadySaved.id, event_id: `lead_${alreadySaved.duplicate_of || alreadySaved.id}`, duplicate: true, is_test: Boolean(alreadySaved.is_test) };
    }
    if (error || !lead) {
      console.error("submitDraft error", error);
      throw new Error("Could not submit your application. Please try again.");
    }

    if ((lead as { duplicate_of?: string | null }).duplicate_of) {
      return { id: lead.id as string, event_id: `lead_${lead.duplicate_of}`, duplicate: true, is_test: false };
    }

    const eventId = `lead_${lead.id}`;

    try {
      await supabaseAdmin.from("consent_records").insert({
        lead_id: lead.id as string,
        policy_version: "1.0",
        consent_contact: Boolean((lead as { consent_contact?: boolean }).consent_contact),
        consent_credit_check: Boolean(input.consents?.consent_credit_check),
        consent_accuracy: Boolean(input.consents?.consent_accuracy),
        consent_not_guarantee: Boolean(input.consents?.consent_not_guarantee),
        marketing_opt_in: Boolean((lead as { consent_marketing?: boolean }).consent_marketing),
        ip_address: ip,
        user_agent: userAgent,
      } as never);
    } catch (e) {
      console.error("consent record error", e);
    }

    if (isTest) {
      console.log("[submitDraft] test-host submission, skipping delivery + CAPI", reqHost);
      return { id: lead.id as string, event_id: eventId, duplicate: false, is_test: true };
    }

    // Fire notifications & CAPI using the existing helpers.
    try {
      const { notifyLeadSubmission } = await import("./leads-notify.server");
      await notifyLeadSubmission(lead as Record<string, unknown>, eventId, ip, userAgent, {
        force: true,
        // Server-side Meta events only for visitors who accepted advertising cookies.
        skipCapi: !input.ad_consent || !input.advertising_consent_id,
        skipEmail: Boolean((currentLead as { email_notified_at?: string | null } | null)?.email_notified_at),
      });
      await supabaseAdmin
        .from("leads")
        .update({ email_notified_at: new Date().toISOString() } as never)
        .eq("id", lead.id as string);
    } catch (e) {
      console.error("submitDraft notify error", e);
    }

    // Automatic delivery to the saved delivery contacts (applicant info only).
    try {
      const { autoDeliverLead } = await import("./lead-delivery.server");
      await autoDeliverLead(lead as Record<string, unknown>);
    } catch (e) {
      console.error("submitDraft auto-deliver error", e);
    }


    return { id: lead.id as string, event_id: eventId, duplicate: false, is_test: false };
  });

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
    referrer: z.string().max(500).optional(),
    landing_page: z.string().max(500).optional(),
    device: z.string().max(40).optional(),
    funnel_variant: z.enum(["A", "B"]).optional(),
  })
  .partial();

const AnonSchema = z.object({
  vehicle_type: z.string().trim().max(40).optional(),
  tracking: TrackingSchema.optional(),
});

/**
 * Opens an anonymous in-progress application as soon as the user answers the
 * first funnel question. No contact info exists yet, so the row stays in
 * "draft" and no notification fires until contact details are attached.
 */
export const startAnonymousDraft = createServerFn({ method: "POST" })
  .inputValidator((i: z.infer<typeof AnonSchema>) => AnonSchema.parse(i))
  .handler(async () => {
    throw new Error("Draft capture is retired. Please use the current application at /apply; it saves only after review and submission.");
  });

const AttachSchema = z.object({
  resume_token: z.string().uuid(),
  first_name: PersonNameSchema,
  last_name: OptionalPersonNameSchema,
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(40)
    .superRefine((v, ctx) => {
      if (!v) return;
      const err = phoneError(v);
      if (err) ctx.addIssue({ code: "custom", message: err });
    })
    .optional()
    .or(z.literal("")),

});

/**
 * Attaches contact details to an existing anonymous draft and promotes it to a
 * "partial" lead, notifying the team once.
 */
export const attachDraftContact = createServerFn({ method: "POST" })
  .inputValidator((i: z.infer<typeof AttachSchema>) => AttachSchema.parse(i))
  .handler(async () => {
    throw new Error("Draft capture is retired. Please use the current application at /apply; it saves only after review and submission.");
  });
