import { LEAD_EMAIL_PREVIEW } from "./privacy-telemetry";
/**
 * Applicant-only view of a lead. Deliberately excludes every internal /
 * marketing field (utm_*, gclid, fbclid, ad ids, source, referrer, landing
 * page, scores, pixel data). Outside recipients only ever see what the
 * customer themselves provided.
 */
import { leadEmailTitle, isPartialEmailLead } from "./lead-email-status";

export const APPLICANT_FIELDS: Array<[string, string]> = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["date_of_birth", "Date of birth"],
  ["is_canadian_resident", "Canadian resident"],
  ["preferred_contact", "Preferred contact"],
  ["best_time_to_contact", "Best time to contact"],
  ["street_address", "Address"],
  ["city", "City"],
  ["province", "Province"],
  ["postal_code", "Postal code"],
  ["residence_status", "Residence status"],
  ["monthly_housing_payment", "Monthly housing payment"],
  ["address_length", "Time at address"],
  ["address_years", "Years at address"],
  ["address_months", "Months at address"],
  ["prev_street_address", "Previous address"],
  ["prev_city", "Previous city"],
  ["prev_province", "Previous province"],
  ["prev_postal_code", "Previous postal code"],
  ["vehicle_type", "Vehicle type"],
  ["vehicle_condition", "New / used preference"],
  ["purchase_timeline", "Purchase timing"],
  ["monthly_budget", "Monthly budget"],
  ["down_payment", "Down payment"],
  ["has_trade_in", "Has trade-in"],
  ["trade_in_year", "Trade-in year"],
  ["trade_in_make", "Trade-in make"],
  ["trade_in_model", "Trade-in model"],
  ["trade_in_trim", "Trade-in trim"],
  ["trade_in_mileage", "Trade-in mileage"],
  ["trade_in_condition", "Trade-in condition"],
  ["trade_in_loan_owing", "Loan owing"],
  ["trade_in_amount_owing", "Amount owing"],
  ["credit_rating", "Credit rating"],
  ["employment_status", "Employment status"],
  ["income_type", "Income type"],
  ["pay_frequency", "Pay frequency"],
  ["income_amount", "Gross income range"],
  ["income_per_pay_period", "Income per pay period"],
  ["additional_income", "Additional income"],
  ["additional_income_source", "Additional income source"],
  ["additional_income_amount", "Additional income amount"],
  ["employment_length", "Employment length"],
  ["income_years", "Years employed"],
  ["income_months", "Months employed"],
  ["employer_name", "Employer"],
  ["job_title", "Job title"],
  ["employer_phone", "Employer phone"],
  ["industry", "Industry"],
  ["business_name", "Business name"],
  ["business_type", "Business type"],
  ["years_in_business", "Years in business"],
  ["has_drivers_licence", "Driver's licence"],
  ["licence_province", "Licence province"],
  ["licence_class", "Licence class"],
];

export function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export function applicantName(l: Record<string, unknown>) {
  return `${esc(l.first_name ?? "")} ${esc(l.last_name ?? "")}`.trim() || "Applicant";
}

/* ------------------------------------------------------------------ */
/* Branded email shell                                                 */
/* ------------------------------------------------------------------ */

const BRAND = {
  navy: "#0F1B3D",
  navyDeep: "#060C1A",
  electric: "#3B6FA0",
  electricSoft: "#E8EDF3",
  text: "#1A2332",
  muted: "#5A6C87",
  line: "#D5DDE8",
  site: "https://autoworldapprovals.com",
  logo: "https://autoworldapprovals.com/__l5e/assets-v1/6a038a3d-6537-4f42-9d8f-f09397525d82/auto-world-approvals-logo-hd.png",
  watermark: "https://autoworldapprovals.com/__l5e/assets-v1/b99e9c1b-170d-4232-be4a-9ddbfbafd1a8/awa-watermark-icon.jpg",
};

function initials(l: Record<string, unknown>) {
  const a = String(l.first_name ?? "").trim()[0] ?? "";
  const b = String(l.last_name ?? "").trim()[0] ?? "";
  return esc((a + b).toUpperCase() || "AW");
}

const EMAIL_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji'";

function summaryChips(l: Record<string, unknown>) {
  const items = [
    l.vehicle_type && `Vehicle: ${l.vehicle_type}`,
    l.monthly_budget && `Budget: ${l.monthly_budget}`,
    l.credit_rating && `Credit: ${l.credit_rating}`,
    l.city && `${l.city}${l.province ? ", " + l.province : ""}`,
  ].filter(Boolean) as string[];
  if (!items.length) return "";
  return `<div style="padding:0 28px 4px">${items
    .map(
      (t) =>
        `<span style="display:inline-block;background:${BRAND.electricSoft};color:${BRAND.navy};font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;margin:0 6px 8px 0;font-family:${EMAIL_FONT}">${esc(t)}</span>`,
    )
    .join("")}</div>`;
}

function contactBar(l: Record<string, unknown>) {
  const phone = String(l.phone ?? "").trim();
  if (!phone) return "";
  const btn = (label: string, href: string) =>
    `<a href="${esc(href)}" style="display:inline-block;background:${BRAND.electric};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 22px;border-radius:10px;margin:0 8px 8px 0;font-family:${EMAIL_FONT}">${esc(label)}</a>`;
  return `<div style="padding:4px 28px 20px">
      ${btn(`Call ${phone}`, `tel:${phone.replace(/[^\d+]/g, "")}`)}
    </div>`;
}


function sectionTitle(t: string) {
  return `<tr><td colspan="2" style="padding:22px 14px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.electric};font-weight:700;font-family:${EMAIL_FONT}">${esc(t)}</td></tr>`;
}

function detailTable(rows: string) {
  if (!rows) return `<p style="padding:0 28px;color:${BRAND.muted};font-size:14px;font-family:${EMAIL_FONT}">No details provided yet.</p>`;
  return `<div style="padding:0 28px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;font-size:15px;border:1px solid ${BRAND.line};border-radius:12px;overflow:hidden;font-family:${EMAIL_FONT}">${rows}</table>
    </div>`;
}

function watermarkStrip() {
  return `<tr><td align="center" style="padding:26px 28px 12px">
    <img src="${BRAND.logo}" alt="Auto World Approvals" width="200" style="display:block;margin:0 auto 12px;width:200px;max-width:60%;height:auto;border:0;opacity:.75" />
    <div style="border-top:1px solid ${BRAND.line};padding-top:16px;font-family:${EMAIL_FONT};font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#A9B6C9">Auto World Approvals · Confidential</div>
  </td></tr>`;
}

function confidentialityNotice() {
  return `<tr><td style="padding:18px 28px 6px;font-family:${EMAIL_FONT}">
    <div style="border:1px solid ${BRAND.line};border-radius:12px;background:#FAFBFF;padding:16px 18px">
      <div style="font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:${BRAND.navy};margin-bottom:8px">Confidentiality &amp; privacy notice</div>
      <p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:${BRAND.muted}">
        This message contains personal information about an identifiable individual who submitted a credit
        pre-qualification enquiry to Auto World Approvals. It is provided to you solely for the purpose of
        assessing, contacting and servicing that individual's vehicle financing request, and for no other purpose.
      </p>
      <p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:${BRAND.muted}">
        By receiving this information you agree to: (1) use it only for the stated purpose; (2) keep it strictly
        confidential and store it securely with access limited to staff who need it; (3) never sell, rent, publish,
        re-share or forward it to any third party without the applicant's express consent; (4) not use it for
        marketing unrelated to this enquiry, or for any automated, list-building or data-enrichment activity;
        (5) handle it in accordance with PIPEDA and all applicable provincial privacy legislation, including BC's
        PIPA and Alberta's PIPA; and (6) securely destroy or return it once the purpose has been fulfilled or upon
        our written request.
      </p>
      <p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:${BRAND.muted}">
        Initial inquiry submission does not authorize a credit check. Any proposed inquiry requires
        appropriate separate notice and informed authorization from the applicant.
      </p>
      <p style="margin:0;font-size:12px;line-height:1.7;color:${BRAND.muted}">
        If you are not the intended recipient, you must not read, copy, retain, disclose or act on this message.
        Please notify us immediately at <a href="mailto:admin@autoworldapprovals.com" style="color:${BRAND.electric};text-decoration:none">admin@autoworldapprovals.com</a>
        and permanently delete it, including any attachments and copies. Unauthorized use or disclosure of this
        information may result in liability under applicable privacy and consumer-protection laws. Any suspected
        loss, theft or unauthorized access to this information must be reported to us without delay.
      </p>
    </div>
  </td></tr>`;
}




function shell(opts: { heading: string; subtitle: string; badge?: string; body: string; footerNote?: string; showWatermark?: boolean }) {
  const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji'";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.electricSoft};font-family:${FONT}">
  <div aria-hidden="true" style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${LEAD_EMAIL_PREVIEW}${"&#847;&zwnj;&nbsp;".repeat(200)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${BRAND.electricSoft};padding:32px 14px;font-family:${FONT}">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 16px 40px rgba(15,27,61,.10);font-family:${FONT};color:${BRAND.text}">
        <tr><td align="center" style="background:#FFFFFF;padding:26px 24px 20px;border-bottom:3px solid ${BRAND.electric}">
          <img src="${BRAND.logo}" alt="Auto World Approvals" width="300" style="display:block;margin:0 auto;width:300px;max-width:78%;height:auto;border:0" />
          <div style="margin-top:12px;font-family:${FONT};font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.14em">Western Canada vehicle inquiries</div>
        </td></tr>

        <tr><td background="${BRAND.watermark}" style="background-color:#ffffff;background-image:url('${BRAND.watermark}');background-repeat:no-repeat;background-position:center 58%;background-size:96% auto;padding:0;font-family:${FONT}">
          <!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:640px;"><v:fill type="frame" src="${BRAND.watermark}" color="#ffffff" /><v:textbox inset="0,0,0,0"><![endif]-->
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-family:${FONT}">
            <tr><td style="padding:28px 28px 6px;font-family:${FONT}">
              ${opts.badge ? `<span style="display:inline-block;background:${BRAND.electricSoft};color:${BRAND.navy};font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;padding:5px 11px;border-radius:999px">${esc(opts.badge)}</span>` : ""}
              <h1 style="margin:12px 0 5px;font-size:24px;line-height:1.3;color:${BRAND.navy};font-weight:700;font-family:${FONT}">${esc(opts.heading)}</h1>
              <p style="margin:0;color:${BRAND.muted};font-size:13px;font-family:${FONT}">${esc(opts.subtitle)}</p>
            </td></tr>
            ${opts.body}
            ${confidentialityNotice()}
            ${opts.showWatermark ? watermarkStrip() : ""}

          </table>
          <!--[if gte mso 9]></v:textbox></v:rect><![endif]-->
        </td></tr>
        <tr><td style="padding:22px 28px 28px;border-top:1px solid ${BRAND.line};background:#FAFBFF;font-family:${FONT}">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${BRAND.navy};font-family:${FONT}">Auto World Approvals</p>
          <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.6;font-family:${FONT}">
            Western Canada vehicle inquiries · <a href="${BRAND.site}" style="color:${BRAND.electric};text-decoration:none">autoworldapprovals.com</a><br />
            Sent ${esc(new Date().toLocaleString())}${opts.footerNote ? ` · ${esc(opts.footerNote)}` : ""}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}


export function leadAssignmentEmailBlock(opts: { assignedToName?: string | null; assignedToEmail?: string | null; assignedListName?: string | null } = {}) {
  const name = String(opts.assignedToName ?? "").trim();
  const email = String(opts.assignedToEmail ?? "").trim();
  const label = name && email ? `${name} (${email})` : name || email || "Not yet assigned";
  return `<div style="margin:12px 0 18px;padding:14px 16px;background:${BRAND.electricSoft};border-left:4px solid ${BRAND.electric};font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;color:${BRAND.navy}"><strong>Assigned to:</strong> ${esc(label)}${opts.assignedListName ? `<br /><strong>Distribution list:</strong> ${esc(opts.assignedListName)}` : ""}</div>`;
}

export function buildApplicantEmailHtml(
  l: Record<string, unknown>,
  opts: {
    message?: string;
    heading?: string;
    recipientName?: string | null;
    /** Who the rotation actually assigned this lead to (may differ from the recipient). */
    assignedToName?: string | null;
    assignedToEmail?: string | null;
    assignedListName?: string | null;
    /** True only when this recipient IS the designated distribution-list owner. */
    recipientIsAssigned?: boolean;
  } = {},
) {
  const rows = fieldRows(withIncomePeriod(l), APPLICANT_FIELDS);

  // The email always greets the reader by name, then states plainly who the
  // lead is actually assigned to on the distribution list. Recipients who are
  // not the designated owner are told they only have a copy for visibility.
  const assignedLabel = String(opts.assignedToName ?? opts.assignedToEmail ?? "").trim();
  const recipientLabel = String(opts.recipientName ?? "").trim();
  const recipientFirst = recipientLabel.split(/\s+/)[0] ?? "";
  const isOwner = opts.recipientIsAssigned === true;
  const line = isOwner
    ? `This lead has been assigned to you. Here are the applicant's details.`
    : assignedLabel
      ? `This lead has been assigned to <strong style="color:${BRAND.navy}">${esc(assignedLabel)}</strong>. You are receiving a copy for visibility only — you are not the designated first point of contact.`
      : `You are receiving a copy of this lead for visibility only — you are not the designated first point of contact.`;
  const greeting = `<tr><td style="padding:18px 28px 0;font-family:${EMAIL_FONT}">
        <div style="font-size:16px;font-weight:700;color:${BRAND.navy};font-family:${EMAIL_FONT}">Hi ${esc(recipientFirst || "there")},</div>
        <div style="margin-top:4px;font-size:14px;line-height:1.6;color:${BRAND.muted};font-family:${EMAIL_FONT}">${line}</div>
      </td></tr>`;



  const note = opts.message?.trim()
    ? `<tr><td style="padding:14px 28px 0;font-family:${EMAIL_FONT}"><div style="background:${BRAND.electricSoft};border-left:4px solid ${BRAND.electric};padding:14px 16px;border-radius:10px;font-size:15px;line-height:1.6;font-family:${EMAIL_FONT}">${esc(opts.message.trim())}</div></td></tr>`
    : "";

  const heading = opts.heading ?? `${leadEmailTitle(l)} — ${applicantName(l)}`;

  const body = `${greeting}<tr><td style="padding:0 28px">${leadAssignmentEmailBlock(opts)}</td></tr>${note}
    <tr><td style="padding:16px 0 0;font-family:${EMAIL_FONT}">
      <div style="padding:0 28px 12px;display:block">
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:${EMAIL_FONT}"><tr>
          <td style="width:46px;height:46px;background:${BRAND.navy};color:#fff;border-radius:50%;text-align:center;font-weight:700;font-size:16px;vertical-align:middle;font-family:${EMAIL_FONT}">${initials(l)}</td>
          <td style="padding-left:12px">
            <div style="font-size:17px;font-weight:700;color:${BRAND.navy};font-family:${EMAIL_FONT}">${applicantName(l)}</div>
            <div style="font-size:14px;color:${BRAND.muted};font-family:${EMAIL_FONT}">${esc(l.email ?? "")}${l.email && l.phone ? " · " : ""}${esc(l.phone ?? "")}</div>
          </td>
        </tr></table>
      </div>
      ${summaryChips(l)}
      ${contactBar(l)}
      ${detailTable(rows)}
    </td></tr>`;

  return shell({
    heading,
    subtitle: "Applicant information shared by Auto World Approvals",
    badge: "Applicant",
    body,
    footerNote: "Please treat this applicant's information as confidential",
    showWatermark: true,
  });
}


/**
 * Internal-only fields. These are Auto World Approvals' own marketing,
 * attribution and CRM data and must NEVER be sent to outside/client
 * recipients — admin recipients only.
 */
export const INTERNAL_FIELDS: Array<[string, string]> = [
  ["status", "Status"],
  ["lead_score", "Lead score"],
  ["completion_pct", "Completion %"],
  ["current_step", "Current step"],
  ["source", "Source"],
  ["attribution_channel", "Attribution channel"],
  ["utm_source", "UTM source"],
  ["utm_medium", "UTM medium"],
  ["utm_campaign", "UTM campaign"],
  ["utm_term", "UTM term"],
  ["utm_content", "UTM content"],
  ["gclid", "Google click ID"],
  ["fbclid", "Facebook click ID"],
  ["msclkid", "Microsoft click ID"],
  ["referrer", "Referrer"],
  ["landing_page", "Landing page"],
  ["device", "Device"],
  ["ip_address", "IP address"],
  ["first_contacted_at", "First contacted at"],
  ["first_contact_by", "First contact by"],
  ["first_contact_source", "First contact source"],
  ["submitted_at", "Submitted at"],
  ["created_at", "Created at"],
  ["last_activity_at", "Last activity"],
];

function fieldRows(l: Record<string, unknown>, fields: Array<[string, string]>) {
  return fields
    .filter(([k]) => {
      const v = l[k];
      return v !== null && v !== undefined && String(v).trim() !== "";
    })
    .map(
      ([k, label], i) =>
        `<tr style="background:${i % 2 ? "#EDF2F9" : "#FFFFFF"}"><td style="padding:10px 14px;color:${BRAND.muted};white-space:nowrap;border-bottom:1px solid ${BRAND.line};width:42%;font-family:${EMAIL_FONT};font-size:15px;background:${i % 2 ? "#EDF2F9" : "#FFFFFF"}">${esc(label)}</td><td style="padding:10px 14px;font-weight:600;color:${BRAND.text};border-bottom:1px solid ${BRAND.line};font-family:${EMAIL_FONT};font-size:15px;background:${i % 2 ? "#EDF2F9" : "#FFFFFF"}">${esc(l[k])}</td></tr>`,
    )
    .join("");
}

function withIncomePeriod(l: Record<string, unknown>): Record<string, unknown> {
  const amount = String(l.income_amount ?? "").trim();
  const frequency = String(l.pay_frequency ?? "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
  return {
    ...l,
    income_per_pay_period: amount
      ? frequency
        ? `${amount} — ${frequency}`
        : amount
      : "",
  };
}

/**
 * Ad-level attribution captured from lead-ad / sheet imports, stored on
 * `leads.extra.campaign`. Admin recipients only — lets us trace a lead back
 * to the exact ad, ad set and campaign that produced it.
 */
const AD_FIELDS: Array<[string, string]> = [
  ["platform", "Platform"],
  ["campaign_name", "Campaign"],
  ["campaign_id", "Campaign ID"],
  ["adset_name", "Ad set"],
  ["adset_id", "Ad set ID"],
  ["ad_name", "Ad"],
  ["ad_id", "Ad ID"],
  ["form_name", "Lead form"],
  ["form_id", "Form ID"],
  ["lead_id", "Platform lead ID"],
  ["created_time", "Submitted (platform)"],
  ["is_organic", "Organic"],
];

function adCampaignData(l: Record<string, unknown>): Record<string, unknown> {
  const extra = (l.extra ?? null) as Record<string, unknown> | null;
  const campaign =
    extra && typeof extra === "object" && extra.campaign && typeof extra.campaign === "object"
      ? (extra.campaign as Record<string, unknown>)
      : {};
  const out: Record<string, unknown> = { ...campaign };
  // Website traffic: Google/Meta pass the ad identifier through UTMs.
  if (!out.ad_id && l.utm_content) out.ad_id = l.utm_content;
  if (!out.campaign_name && l.utm_campaign) out.campaign_name = l.utm_campaign;
  if (!out.platform && l.attribution_channel) out.platform = l.attribution_channel;
  return out;
}

/**
 * Full internal lead view for Auto World Approvals admin recipients: the
 * applicant's information plus all marketing / attribution / CRM data.
 */
export function buildFullLeadEmailHtml(l: Record<string, unknown>, opts: { heading?: string; assignedToName?: string | null; assignedToEmail?: string | null; assignedListName?: string | null } = {}) {
  const heading = opts.heading ?? `${leadEmailTitle(l)} — ${applicantName(l)}`;
  const applicant = fieldRows(withIncomePeriod(l), APPLICANT_FIELDS);
  const internal = fieldRows(l, INTERNAL_FIELDS);
  const ad = fieldRows(adCampaignData(l), AD_FIELDS);


  const body = `<tr><td style="padding:16px 0 0;font-family:${EMAIL_FONT}">
      <div style="padding:0 28px">${leadAssignmentEmailBlock(opts)}</div>
      <div style="padding:0 28px 12px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:${EMAIL_FONT}"><tr>
          <td style="width:46px;height:46px;background:${BRAND.navy};color:#fff;border-radius:50%;text-align:center;font-weight:700;font-size:16px;vertical-align:middle;font-family:${EMAIL_FONT}">${initials(l)}</td>
          <td style="padding-left:12px">
            <div style="font-size:17px;font-weight:700;color:${BRAND.navy};font-family:${EMAIL_FONT}">${applicantName(l)}</div>
            <div style="font-size:14px;color:${BRAND.muted};font-family:${EMAIL_FONT}">${esc(l.email ?? "")}${l.email && l.phone ? " · " : ""}${esc(l.phone ?? "")}</div>
          </td>
        </tr></table>
      </div>
      ${summaryChips(l)}
      ${contactBar(l)}
      <div style="padding:0 28px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-family:${EMAIL_FONT}">${sectionTitle("Applicant information")}</table></div>
      ${detailTable(applicant)}
      ${ad ? `<div style="padding:0 28px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-family:${EMAIL_FONT}">${sectionTitle("Ad & campaign attribution")}</table></div>${detailTable(ad)}` : ""}
      <div style="padding:0 28px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-family:${EMAIL_FONT}">${sectionTitle("Internal / marketing data")}</table></div>
      ${detailTable(internal)}

      <div style="padding:18px 28px 0"><div style="background:#FFF7E6;border-left:4px solid #E0A800;padding:12px 14px;border-radius:10px;font-size:13px;color:#7A5B00;font-family:${EMAIL_FONT}">Internal admin copy — do not forward outside Auto World Approvals.</div></div>
    </td></tr>`;

  return shell({
    heading,
    subtitle: "Internal admin copy — all available details",
    badge: isPartialEmailLead(l) ? "Partial lead" : "Completed application",
    body,
    footerNote: "Confidential internal copy",
    showWatermark: true,

  });
}

