import { NextResponse, type NextRequest } from "next/server";
import { IntakeSubmissionSchema, INTAKE_CONSENT_VERSION } from "@/lib/funnel/intake-validation";
import { hostFromHeader, isProductionHost } from "@/lib/prod-host";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = IntakeSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const input = parsed.data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = req.headers.get("origin") || req.headers.get("referer") || req.headers.get("host") || "";
    const host = hostFromHeader(origin);
    const isTest = !isProductionHost(host);

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("leads")
      .select("id,submitted_at,is_test,duplicate_of")
      .eq("resume_token", input.idempotency_key)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: "Unable to check your application. Please try again." },
        { status: 500 }
      );
    }

    if (existing?.submitted_at) {
      const response = NextResponse.json({
        id: existing.id,
        event_id: `lead_${existing.duplicate_of || existing.id}`,
        duplicate: true,
        is_test: Boolean(existing.is_test),
      });
      response.cookies.set("awa-intake-receipt", input.idempotency_key, {
        httpOnly: true,
        secure: isProductionHost(host),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
      return response;
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const agent = req.headers.get("user-agent") || null;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${ip || "unknown"}|${agent || "unknown"}`)
    );
    const bucket = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: allowed, error: limitError } = await supabaseAdmin.rpc("claim_intake_rate_limit", {
      _bucket_key: bucket,
    });
    if (limitError || !allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait before trying again." },
        { status: 429 }
      );
    }

    const now = new Date().toISOString();
    const { channel, ...tracking } = input.tracking ?? {};
    const row = {
      ...input.answers,
      ...tracking,
      ...input.consents,
      phone: normalizePhone(input.answers.phone),
      resume_token: input.idempotency_key,
      is_test: isTest,
      source: "website",
      status: "new" as const,
      submitted_at: now,
      last_activity_at: now,
      completion_pct: 100,
      current_step: "submitted",
      consent_credit_check: false,
      consent_timestamp: now,
      consent_contact_captured_at: now,
      consent_policy_version: INTAKE_CONSENT_VERSION,
      consent_ip: ip,
      consent_user_agent: agent,
      ip_address: ip,
      attribution_channel: channel ?? null,
      advertising_consent_id: input.advertising_consent_id ?? null,
    };

    const { computeLeadScore } = await import("@/lib/lead-score");
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert({ ...row, lead_score: computeLeadScore(row) })
      .select("*")
      .single();

    if (error || !lead) {
      const { data: saved } = await supabaseAdmin
        .from("leads")
        .select("id,submitted_at,is_test,duplicate_of")
        .eq("resume_token", input.idempotency_key)
        .maybeSingle();

      if (saved?.submitted_at) {
        const response = NextResponse.json({
          id: saved.id,
          event_id: `lead_${saved.duplicate_of || saved.id}`,
          duplicate: true,
          is_test: Boolean(saved.is_test),
        });
        response.cookies.set("awa-intake-receipt", input.idempotency_key, {
          httpOnly: true,
          secure: isProductionHost(host),
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60,
        });
        return response;
      }
      return NextResponse.json(
        { error: "Your application could not be saved. Please try again." },
        { status: 500 }
      );
    }

    const eventId = `lead_${lead.duplicate_of || lead.id}`;
    if (!isTest && !lead.duplicate_of) {
      const { notifyLeadSubmission } = await import("@/lib/leads-notify.server");
      await notifyLeadSubmission(lead as Record<string, unknown>, eventId, ip, agent, {
        force: true,
        skipCapi: !input.ad_consent || !input.advertising_consent_id,
      });
      try {
        const { autoDeliverLead } = await import("@/lib/lead-delivery.server");
        await autoDeliverLead(lead as Record<string, unknown>);
      } catch (err) {
        console.error("[intake] delivery pending recovery", lead.id, err);
      }

      // Forward lead directly to Auto World Approvals CRM
      const crmUrl = process.env.CRM_API_URL || "https://crm.autoworldapprovals.com/api/leads";
      const leadObj = lead as Record<string, any>;
      const crmPayload = {
        source: "website_apply",
        firstName: leadObj.first_name,
        lastName: leadObj.last_name,
        phone: leadObj.phone,
        email: leadObj.email,
        province: leadObj.province,
        city: leadObj.city,
        vehicleType: leadObj.vehicle_type,
        desiredVehicle: leadObj.vehicle_type ? `${String(leadObj.vehicle_type).toUpperCase()} Financing` : "Vehicle Financing",
        grossMonthlyIncome: Number(leadObj.monthly_income || leadObj.income_amount || 0),
        downPayment: Number(leadObj.down_payment || 0),
        creditScore: leadObj.credit_rating || "Good (650+)",
        employmentStatus: leadObj.employment_status || "Full-Time Employed",
        employerName: leadObj.employer_name || "",
        tradeIn: leadObj.has_trade_in ? {
          hasTradeIn: true,
          year: leadObj.trade_in_year,
          make: leadObj.trade_in_make,
          model: leadObj.trade_in_model,
          mileageKm: leadObj.trade_in_mileage,
        } : { hasTradeIn: false },
      };

      try {
        await fetch(crmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(crmPayload),
        });
      } catch {
        // If HTTPS refused before SSL setup, retry via HTTP
        if (crmUrl.startsWith("https://")) {
          try {
            await fetch(crmUrl.replace("https://", "http://"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(crmPayload),
            });
          } catch {}
        }
      }
    }

    const response = NextResponse.json({
      id: lead.id,
      event_id: eventId,
      duplicate: Boolean(lead.duplicate_of),
      is_test: isTest,
    });
    response.cookies.set("awa-intake-receipt", input.idempotency_key, {
      httpOnly: true,
      secure: isProductionHost(host),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
    return response;
  } catch (err) {
    console.error("API error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
