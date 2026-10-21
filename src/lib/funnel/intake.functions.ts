import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { IntakeSubmissionSchema, INTAKE_CONSENT_VERSION } from "./intake-validation";
import { hostFromHeader, isProductionHost } from "@/lib/prod-host";
import { normalizePhone } from "@/lib/phone";

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof IntakeSubmissionSchema>) => IntakeSubmissionSchema.parse(input))
  .handler(async ({ data: input }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const host = hostFromHeader(getRequestHeader("origin") || getRequestHeader("referer") || getRequestHeader("host"));
    const isTest = !isProductionHost(host);
    const setReceipt = () => setCookie("awa-intake-receipt", input.idempotency_key, { httpOnly: true, secure: isProductionHost(host), sameSite: "lax", path: "/", maxAge: 60 * 60 });
    const { data: existing, error: lookupError } = await supabaseAdmin.from("leads").select("id,submitted_at,is_test,duplicate_of").eq("resume_token", input.idempotency_key).maybeSingle();
    if (lookupError) throw new Error("Unable to check your application. Please try again.");
    if (existing?.submitted_at) { setReceipt(); return { id: existing.id, event_id: `lead_${existing.duplicate_of || existing.id}`, duplicate: true, is_test: Boolean(existing.is_test) }; }
    const ip = getRequestIP({ xForwardedFor: true }) || null;
    const agent = getRequestHeader("user-agent") || null;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip || "unknown"}|${agent || "unknown"}`));
    const bucket = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data: allowed, error: limitError } = await supabaseAdmin.rpc("claim_intake_rate_limit", { _bucket_key: bucket });
    if (limitError || !allowed) throw new Error("Too many attempts. Please wait before trying again.");
    const now = new Date().toISOString();
    const { channel, ...tracking } = input.tracking ?? {};
    const row = {
      ...input.answers, ...tracking, ...input.consents,
      phone: normalizePhone(input.answers.phone),
      resume_token: input.idempotency_key, is_test: isTest, source: "website", status: "new" as const,
      submitted_at: now, last_activity_at: now, completion_pct: 100, current_step: "submitted",
      consent_credit_check: false, consent_timestamp: now, consent_contact_captured_at: now,
      consent_policy_version: INTAKE_CONSENT_VERSION, consent_ip: ip, consent_user_agent: agent,
      ip_address: ip, attribution_channel: channel ?? null,
      advertising_consent_id: input.advertising_consent_id ?? null,
    };
    const { computeLeadScore } = await import("@/lib/lead-score");
    const { data: lead, error } = await supabaseAdmin.from("leads").insert({ ...row, lead_score: computeLeadScore(row) }).select("*").single();
    if (error || !lead) {
      // A lost response or concurrent retry returns the same committed row.
      const { data: saved } = await supabaseAdmin.from("leads").select("id,submitted_at,is_test,duplicate_of").eq("resume_token", input.idempotency_key).maybeSingle();
      if (saved?.submitted_at) { setReceipt(); return { id: saved.id, event_id: `lead_${saved.duplicate_of || saved.id}`, duplicate: true, is_test: Boolean(saved.is_test) }; }
      throw new Error("Your application could not be saved. Your answers are still here; please try again.");
    }
    const eventId = `lead_${lead.duplicate_of || lead.id}`;
    setReceipt();
    if (!isTest && !lead.duplicate_of) {
      const { notifyLeadSubmission } = await import("@/lib/leads-notify.server");
      await notifyLeadSubmission(lead as Record<string, unknown>, eventId, ip, agent, { force: true, skipCapi: !input.ad_consent || !input.advertising_consent_id });
      try {
        const { autoDeliverLead } = await import("@/lib/lead-delivery.server");
        await autoDeliverLead(lead as Record<string, unknown>);
      } catch { console.error("[intake] delivery pending recovery", lead.id); }
    }
    return { id: lead.id, event_id: eventId, duplicate: Boolean(lead.duplicate_of), is_test: isTest };
  });

export const confirmIntakeReceipt = createServerFn({ method: "GET" })
  .inputValidator((input: { id?: string }) => z.object({ id: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data }) => {
    const token = getCookie("awa-intake-receipt");
    if (!token || !data.id) return { confirmed: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved } = await supabaseAdmin.from("leads").select("id").eq("id", data.id).eq("resume_token", token).not("submitted_at", "is", null).maybeSingle();
    return { confirmed: Boolean(saved) };
  });