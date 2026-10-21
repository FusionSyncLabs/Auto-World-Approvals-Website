import { emailProviderFailure, LEAD_EMAIL_PREVIEW } from "./privacy-telemetry";
import { APPLICANT_FIELDS, INTERNAL_FIELDS } from "./lead-share";


import { leadEmailTitle } from "./lead-email-status";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendFacebookLeadEvent(lead: Record<string, unknown>, eventId: string, ip: string | null, userAgent: string | null) {
  const { permittedAdvertising } = await import("./ad-consent.server");
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const { hostFromHeader } = await import("./prod-host");
  const { buildLeadEvent } = await import("./ad-policy");
  const host = hostFromHeader(getRequestHeader("origin") || getRequestHeader("referer"));
  const consentId = typeof lead.advertising_consent_id === "string" ? lead.advertising_consent_id : null;
  if (lead.is_test || !lead.submitted_at || !await permittedAdvertising(consentId, host)) return;
  // No contact, credit, income, address or matching identifiers leave the application.
  const pixelId = process.env.FACEBOOK_PIXEL_ID;
  const accessToken = process.env.FACEBOOK_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken || !userAgent) return;
  const event = buildLeadEvent(String(lead.id), String(lead.submitted_at));
  if (!Number.isFinite(event.event_time) || eventId !== event.event_id) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: claimError } = await supabaseAdmin.from("ad_conversion_log").insert({ event_id: eventId, lead_id: String(lead.id), event_name: "Lead", occurred_at: String(lead.submitted_at), consent_record_id: consentId });
  if (claimError) return; // Stable primary key prevents retries from creating conversions.
  if (!await permittedAdvertising(consentId, host)) {
    await supabaseAdmin.from("ad_conversion_log").update({ status: "blocked" }).eq("event_id", eventId); return;
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: accessToken, data: [{ ...event, user_data: { client_user_agent: userAgent, ...(ip ? { client_ip_address: ip } : {}) } }] }) });
    await supabaseAdmin.from("ad_conversion_log").update({ status: res.ok ? "sent" : "failed", http_status: res.status }).eq("event_id", eventId);
  } catch { await supabaseAdmin.from("ad_conversion_log").update({ status: "failed" }).eq("event_id", eventId); }
}

const FIELD_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  province: "Province",
  city: "City",
  postal_code: "Postal code",
  address: "Address",
  date_of_birth: "Date of birth",
  vehicle_type: "Vehicle type",
  vehicle_use: "Vehicle use",
  monthly_budget: "Monthly budget",
  down_payment: "Down payment",
  credit_rating: "Credit rating",
  employment_status: "Employment status",
  employer_name: "Employer",
  job_title: "Job title",
  income_amount: "Income amount",
  pay_frequency: "Pay frequency",
  monthly_income: "Monthly income",
  time_at_employer: "Time at employer",
  housing_status: "Housing status",
  monthly_housing_payment: "Monthly housing payment",
  time_at_address: "Time at address",
  lead_score: "Lead score",
  source: "Source",
  attribution_channel: "Traffic channel",
  utm_source: "UTM source",
  utm_medium: "UTM medium",
  utm_campaign: "UTM campaign",
  utm_term: "UTM term",
  utm_content: "UTM content",
  gclid: "Google click ID",
  fbclid: "Facebook click ID",
  msclkid: "Microsoft click ID",
  referrer: "Referrer",
  landing_page: "Landing page",
  device: "Device",
};

function labelFor(key: string) {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function fmtField(key: string, value: unknown): string {
  if (key === "pay_frequency" && typeof value === "string") {
    return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
  }
  return fmt(value);
}

const HIDDEN_KEYS = new Set([
  "id",
  "created_at",
  "updated_at",
  "assigned_to",
  "notes",
  "status",
  "consent_accuracy",
  "consent_contact",
  "consent_credit_check",
  "consent_not_guarantee",
  "consent_marketing",
  "consent_timestamp",
  "consent_policy_version",
]);

function row(k: string, v: string) {
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;width:180px;vertical-align:top;border-bottom:1px solid #f1f5f9">${k}</td><td style="padding:6px 0;color:#111;border-bottom:1px solid #f1f5f9">${v}</td></tr>`;
}

async function sendLeadEmails(lead: Record<string, unknown>, opts: { force?: boolean; eventId?: string } = {}) {
  // Establish the existing geographic/round-robin ownership before any
  // notification is rendered. Delivery claims make subsequent calls safe.
  const { autoDeliverLead } = await import("./lead-delivery.server");
  await autoDeliverLead(lead);
  const { getLeadEmailAssignment } = await import("./lead-assignment.server");
  const { leadAssignmentEmailBlock } = await import("./lead-share");
  const assignment = await getLeadEmailAssignment(String(lead.id));
  const resendKey = process.env.RESEND_API_KEY;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", ["lead_notification_emails", "from_email", "notify_on_new_lead", "notify_min_score", "logo_url"]);

  const m = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]));
  const configuredToList = (Array.isArray(m.lead_notification_emails) ? m.lead_notification_emails : []) as string[];
  // The automatic delivery library is the source of truth for lead routing.
  // Exclude those addresses from the legacy notification list so the same
  // recipient cannot receive both a notification copy and an auto-delivery copy.
  const { data: deliveryContacts } = await supabaseAdmin
    .from("lead_delivery_contacts")
    .select("email")
    .eq("is_active", true);
  const autoEmails = new Set((deliveryContacts ?? []).map((c) => c.email.trim().toLowerCase()));
  const toList = configuredToList.filter((email) => !autoEmails.has(email.trim().toLowerCase()));
  const from = (typeof m.from_email === "string" && m.from_email) || "Auto World Approvals <onboarding@resend.dev>";
  // When force=true (partial or full lead submission, or manual resend), we
  // always deliver to the configured recipients — bypass the notify toggle
  // and min-score threshold so no lead gets missed.
  const notifyEnabled = opts.force ? true : m.notify_on_new_lead !== false;
  const minScore = typeof m.notify_min_score === "number" ? m.notify_min_score : 0;
  const rawLogoUrl = typeof m.logo_url === "string" ? m.logo_url : "";
  const logoUrl = rawLogoUrl.startsWith("/")
    ? `https://www.autoworldapprovals.com${rawLogoUrl}`
    : rawLogoUrl;
  const logoHeader = logoUrl
    ? `<div style="text-align:center;background:#ffffff;padding:24px 20px 18px"><img src="${escapeHtml(logoUrl)}" alt="Auto World Approvals" width="300" style="display:block;margin:0 auto;width:300px;max-width:78%;height:auto;border:0" /></div>`
    : "";


  if (!resendKey) {
    console.log("[email] RESEND_API_KEY not set — skipping notification for lead", lead.id);
    return;
  }

  const score = (lead.lead_score as number) ?? 0;
  const isIntake = lead.consent_policy_version === "intake-2026-10-v2";
  const manualResend = opts.eventId?.includes("_resend_") === true;
  const { data: previousSends } = isIntake && !manualResend
    ? await supabaseAdmin.from("notification_log").select("kind").eq("lead_id", String(lead.id)).eq("status", "sent")
    : { data: [] };
  const sentKinds = new Set((previousSends || []).map((row) => row.kind));
  const automaticEvent = isIntake && !manualResend ? `lead_${lead.id}` : opts.eventId || `lead_${lead.id}`;
  const meetsThreshold = opts.force || score >= minScore;

  const firstName = (lead.first_name as string) ?? "";
  const lastName = (lead.last_name as string) ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || "(no name)";
  const subject = `${leadEmailTitle(lead)} — ${fullName}`;

  // Where did this lead come from? Prefer the stored channel, otherwise derive
  // it from the UTMs / click IDs / referrer we captured.
  const { deriveChannel } = await import("@/lib/attribution");
  const channel =
    (lead.attribution_channel as string) ||
    deriveChannel({
      utm_source: (lead.utm_source as string) ?? undefined,
      utm_medium: (lead.utm_medium as string) ?? undefined,
      gclid: (lead.gclid as string) ?? undefined,
      fbclid: (lead.fbclid as string) ?? undefined,
      msclkid: (lead.msclkid as string) ?? undefined,
      referrer: (lead.referrer as string) ?? undefined,
    });
  const campaignBits = [lead.utm_campaign, lead.utm_medium, lead.utm_content]
    .filter(Boolean)
    .map((v) => escapeHtml(String(v)))
    .join(" · ");

  // Ad-platform campaign metadata captured from sheet/lead-ad imports.
  const extra = (lead.extra ?? null) as Record<string, unknown> | null;
  const campaign = (extra && typeof extra === "object" ? (extra.campaign as Record<string, unknown>) : null) || null;
  const CAMPAIGN_LABELS: Record<string, string> = {
    campaign_name: "Campaign",
    adset_name: "Ad set",
    ad_name: "Ad",
    form_name: "Lead form",
    platform: "Platform",
    created_time: "Submitted (platform)",
    lead_status: "Platform lead status",
    is_organic: "Organic",
    lead_id: "Platform lead ID",
    campaign_id: "Campaign ID",
    adset_id: "Ad set ID",
    ad_id: "Ad ID",
    form_id: "Form ID",
  };
  const campaignRows = campaign
    ? Object.keys(CAMPAIGN_LABELS)
        .filter((k) => campaign[k])
        .map(
          (k) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#64748b;width:170px;vertical-align:top">${escapeHtml(
              CAMPAIGN_LABELS[k],
            )}</td><td style="padding:4px 0;color:#0a1733;font-weight:600">${escapeHtml(String(campaign[k]))}</td></tr>`,
        )
        .join("")
    : "";
  const campaignBlock = campaignRows
    ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:18px">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#0f172a;font-weight:700;margin-bottom:6px">Campaign details</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">${campaignRows}</table>
      </div>`
    : "";

  const sourceBanner = `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:18px">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#1d4ed8;font-weight:700">Lead source</div>
        <div style="font-size:16px;font-weight:700;color:#0a1733;margin-top:4px">${escapeHtml(channel)}</div>
        ${campaignBits ? `<div style="font-size:13px;color:#475569;margin-top:4px">${campaignBits}</div>` : ""}
        ${lead.landing_page ? `<div style="font-size:12px;color:#64748b;margin-top:4px">Landed on: ${escapeHtml(String(lead.landing_page))}</div>` : ""}
      </div>${campaignBlock}`;


  // Explicit allowlist prevents newly added confidential/internal fields from leaking.
  const ordered = Array.from(new Set([...APPLICANT_FIELDS, ...INTERNAL_FIELDS].map(([key]) => key))).filter((key) => key in lead);

  const rowsHtml = ordered
    .map((k) => row(escapeHtml(labelFor(k)), escapeHtml(fmtField(k, lead[k]))))
    .join("");

  const adminHtml = `
    <div aria-hidden="true" style="display:none;max-height:0;overflow:hidden;mso-hide:all">${LEAD_EMAIL_PREVIEW}${"&#847;&zwnj;&nbsp;".repeat(200)}</div>
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto">
      ${logoHeader}
      <div style="background:#0a1733;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:20px">${escapeHtml(leadEmailTitle(lead))}</h1>
        <p style="margin:6px 0 0;color:#9bb4e6">Score: <strong style="color:#fff">${score}</strong> · Source: <strong style="color:#fff">${escapeHtml(channel)}</strong></p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
        ${leadAssignmentEmailBlock(assignment)}
        ${sourceBanner}
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${rowsHtml}
        </table>
        <p style="margin-top:20px;font-size:13px;color:#6b7280">Lead ID: ${escapeHtml(String(lead.id))}<br/>Full details are included in the attached Excel file.</p>
      </div>
    </div>`;

  let attachments: { filename: string; content: string }[] = [];
  try {
    const XLSX = await import("xlsx");
    const sheetData = ordered.map((k) => ({ Field: labelFor(k), Value: fmtField(k, lead[k]) }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 28 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lead");
    const buf = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
    const safeName = fullName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "lead";
    attachments = [{ filename: `lead-${safeName}-${String(lead.id).slice(0, 8)}.xlsx`, content: buf }];
  } catch (e) {
    console.error("[email] xlsx generation failed");
  }

  if (notifyEnabled && meetsThreshold && toList.length > 0 && !sentKinds.has("admin_notification")) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `${automaticEvent}_admin_notification` },
      body: JSON.stringify({ from, to: toList, subject, html: adminHtml, attachments }),
    });
    if (!res.ok) {
      console.error("[email] admin notification failed", res.status);
      await logNotification(lead.id as string, "admin_notification", toList.join(", "), subject, "failed", emailProviderFailure(res.status));
    } else {
      await logNotification(lead.id as string, "admin_notification", toList.join(", "), subject, "sent", null);
    }
  } else if (configuredToList.length === 0) {
    console.warn("[email] no lead_notification_emails configured — lead", lead.id, "not delivered to any admin");
  }

  if (lead.email && !sentKinds.has("applicant_confirmation")) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `${automaticEvent}_applicant_confirmation` },
      body: JSON.stringify({
        from,
        to: [lead.email],
        subject: "We received your Auto World Approvals application",
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          ${logoHeader}
          <h2 style="color:#0a1733">Thanks, ${escapeHtml(firstName) || "there"}!</h2>
          <p>We've received your inquiry. An advisor will review your preferences and contact you about any further information needed. This is not a financing approval or interest-rate offer.</p>
          <p style="color:#6b7280;font-size:13px;margin-top:24px">— Auto World Approvals</p>
        </div>`,
      }),
    });
    if (!res.ok) {
      console.error("[email] applicant confirmation failed", res.status);
      await logNotification(lead.id as string, "applicant_confirmation", lead.email as string, "We received your Auto World Approvals application", "failed", emailProviderFailure(res.status));
    } else {
      await logNotification(lead.id as string, "applicant_confirmation", lead.email as string, "We received your Auto World Approvals application", "sent", null);
    }
  }
}

async function logNotification(
  leadId: string | null,
  kind: string,
  recipient: string,
  subject: string | null,
  status: "sent" | "failed",
  error: string | null,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notification_log").insert({
      lead_id: leadId,
      kind,
      recipient,
      subject,
      status,
      error,
    } as never);
  } catch (e) {
    console.error("[notification-log] insert failed");
  }
}

export async function notifyLeadSubmission(
  lead: Record<string, unknown>,
  eventId: string,
  ip: string | null,
  userAgent: string | null,
  opts: { force?: boolean; skipCapi?: boolean; skipEmail?: boolean } = {},
) {
  if (lead.is_test) return;
  if (lead.duplicate_of || lead.status === "duplicate") {
    console.log("[lead-notify] duplicate lead suppressed", lead.id);
    return;
  }
  if (!opts.skipEmail) {
    try { await sendLeadEmails(lead, { force: opts.force, eventId }); } catch (e) { console.error("[email] request failed; recovery required"); }
  }
  if (!opts.skipCapi) {
    try { await sendFacebookLeadEvent(lead, eventId, ip, userAgent); } catch (e) { console.error("[capi] request failed"); }
  }
}
