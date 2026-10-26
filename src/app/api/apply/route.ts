import { NextResponse, type NextRequest, after } from "next/server";
import { IntakeSubmissionSchema, INTAKE_CONSENT_VERSION } from "@/lib/funnel/intake-validation";
import { hostFromHeader, isProductionHost } from "@/lib/prod-host";
import { normalizePhone } from "@/lib/phone";
import { buildFbc, sendMetaEvent, type MetaServerEvent } from "@/lib/meta-capi";

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
    const isTradeIn = input.source === "trade_in_form" || body.source === "trade_in_form";

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
      const existingEventId = `${isTradeIn ? "tradein" : "lead"}_${existing.duplicate_of || existing.id}`;
      const response = NextResponse.json({
        id: existing.id,
        event_id: existingEventId,
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
    const { channel, fbclid_ts, fbp, fbc, xid, ...tracking } = input.tracking ?? {};
    const row = {
      ...input.answers,
      ...tracking,
      ...input.consents,
      phone: normalizePhone(input.answers.phone),
      resume_token: input.idempotency_key,
      is_test: isTest,
      source: isTradeIn ? "trade_in_form" : "website",
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
        const savedEventId = `${isTradeIn ? "tradein" : "lead"}_${saved.duplicate_of || saved.id}`;
        const response = NextResponse.json({
          id: saved.id,
          event_id: savedEventId,
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

    const eventId = `${isTradeIn ? "tradein" : "lead"}_${lead.duplicate_of || lead.id}`;

    // Store meta_event_id on lead
    try {
      await supabaseAdmin.from("leads").update({ meta_event_id: eventId } as any).eq("id", lead.id);
    } catch {}

    const secGpc = req.headers.get("sec-gpc");
    const consentRecordId = input.advertising_consent_id;
    let consentOk = Boolean(input.ad_consent === true && secGpc !== "1");

    if (consentOk && consentRecordId) {
      try {
        const visitorToken = req.cookies.get("awa_consent_visitor")?.value;
        const { data: atEvent } = await supabaseAdmin
          .from("advertising_consent_records")
          .select("visitor_token,advertising")
          .eq("id", consentRecordId)
          .maybeSingle();

        if (atEvent && atEvent.advertising === true) {
          if (!visitorToken || !atEvent.visitor_token || atEvent.visitor_token === visitorToken) {
            consentOk = true;
          } else {
            consentOk = false;
          }
        } else {
          consentOk = false;
        }
      } catch {
        // fail closed on consent verification error
        consentOk = false;
      }
    }

    if (consentOk && !isTest && !lead.duplicate_of) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://autoworldapprovals.com";
      const fbp = req.cookies.get("_fbp")?.value || input.tracking?.fbp;
      const fbc =
        req.cookies.get("_fbc")?.value ||
        input.tracking?.fbc ||
        buildFbc(input.tracking?.fbclid, input.tracking?.fbclid_ts ? Number(input.tracking?.fbclid_ts) : undefined);
      const xid = req.cookies.get("aw_xid")?.value || input.tracking?.xid;

      const metaEvent: MetaServerEvent = {
        eventName: isTradeIn ? "TradeInRequest" : "Lead",
        eventId,
        sourceUrl: `${siteUrl}/${isTradeIn ? "sell-trade-in" : "apply"}`,
        ip,
        userAgent: agent,
        fbp,
        fbc,
        xid,
      };

      after(async () => {
        try {
          const sent = await sendMetaEvent(metaEvent);
          if (sent) {
            await supabaseAdmin
              .from("leads")
              .update({ capi_sent_at: new Date().toISOString() } as any)
              .eq("id", lead.id);
            await supabaseAdmin.from("ad_conversion_log").insert({
              event_id: eventId,
              lead_id: String(lead.id),
              event_name: metaEvent.eventName,
              occurred_at: now,
              consent_record_id: consentRecordId ?? null,
              status: "sent",
            } as any);
          }
        } catch (capiErr) {
          console.error("[apply/route] CAPI send exception:", capiErr);
        }
      });
    }

    if (!isTest && !lead.duplicate_of) {
      const { notifyLeadSubmission } = await import("@/lib/leads-notify.server");
      await notifyLeadSubmission(lead as Record<string, unknown>, eventId, ip, agent, {
        force: true,
        skipCapi: true, // Managed by meta-capi above
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
        source: isTradeIn ? "website_trade_in" : "website_apply",
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
        utmSource: leadObj.utm_source || undefined,
        utmMedium: leadObj.utm_medium || undefined,
        utmCampaign: leadObj.utm_campaign || undefined,
        utmTerm: leadObj.utm_term || undefined,
        utmContent: leadObj.utm_content || undefined,
        fbclid: leadObj.fbclid || undefined,
        gclid: leadObj.gclid || undefined,
        metaEventId: eventId,
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

