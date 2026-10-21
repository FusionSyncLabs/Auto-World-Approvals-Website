/**
 * Google Sheet lead intake hook.
 *
 * Called by a Google Apps Script trigger whenever a new row is added to the
 * connected sheet. Inserts the row as a lead and fires the same admin
 * notification email used by the website forms.
 *
 * Auth: shared secret in the `x-sheet-token` header (or `token` in the body),
 * compared against the SHEET_LEAD_TOKEN secret.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { OptionalPersonNameSchema, NAME_ERROR } from "@/lib/name-validation";

const PayloadSchema = z.object({
  token: z.string().optional(),
  // Either a flat object of column header -> value, or the mapped fields below.
  row: z.record(z.string(), z.unknown()).optional(),
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(60).optional(),
  date_of_birth: z.string().max(60).optional(),
  street_address: z.string().max(255).optional(),
  city: z.string().max(120).optional(),
  province: z.string().max(120).optional(),
  postal_code: z.string().max(30).optional(),
  residence_status: z.string().max(120).optional(),
  monthly_housing_payment: z.string().max(60).optional(),
  vehicle_type: z.string().max(120).optional(),
  monthly_budget: z.string().max(120).optional(),
  down_payment: z.string().max(60).optional(),
  has_trade_in: z.string().max(60).optional(),
  trade_in_year: z.string().max(30).optional(),
  trade_in_make: z.string().max(80).optional(),
  trade_in_model: z.string().max(80).optional(),
  credit_rating: z.string().max(120).optional(),
  employment_status: z.string().max(120).optional(),
  income_amount: z.string().max(60).optional(),
  employer_name: z.string().max(160).optional(),
  job_title: z.string().max(200).optional(),
  has_drivers_licence: z.string().max(60).optional(),
  preferred_contact: z.string().max(60).optional(),
  source: z.string().max(120).optional(),
});

/**
 * Column matching for sheet imports.
 *
 * Sheet headers are rarely stable — Meta lead-ad forms export the full question
 * text ("what type of vehicle are you most interested in?"). So each field has
 * exact aliases (checked first, highest confidence) plus loose patterns that
 * match anywhere in the header text. Order matters: more specific fields are
 * listed before generic ones ("last name" before "name").
 */
type Matcher = { field: string; exact: string[]; patterns?: RegExp[] };

const MATCHERS: Matcher[] = [
  { field: "email", exact: ["email", "email address", "e-mail"], patterns: [/\bemail\b|\be-?mail\b/] },
  {
    field: "phone",
    exact: ["phone", "phone number", "mobile", "cell", "telephone", "contact number"],
    patterns: [/\bphone|mobile|cell number|telephone|contact number/],
  },
  { field: "last_name", exact: ["last name", "lastname", "last", "surname", "family name"], patterns: [/last name|surname|family name/] },
  { field: "first_name", exact: ["first name", "firstname", "first", "given name", "full name", "name"], patterns: [/first name|given name|full name|^name$/] },
  { field: "date_of_birth", exact: ["dob", "date of birth", "birthday"], patterns: [/date of birth|birth ?day|\bdob\b/] },
  { field: "postal_code", exact: ["postal code", "postal", "zip", "zip code"], patterns: [/postal|zip/] },
  { field: "street_address", exact: ["address", "street address", "street"], patterns: [/street|home address|^address/] },
  { field: "city", exact: ["city", "town"], patterns: [/\bcity\b|\btown\b/] },
  { field: "province", exact: ["province", "state", "prov"], patterns: [/province|\bstate\b/] },
  {
    field: "residence_status",
    exact: ["residence status", "housing", "housing status", "own or rent"],
    patterns: [/own or rent|rent or own|residence|housing status/],
  },
  { field: "monthly_housing_payment", exact: ["rent", "mortgage", "monthly rent"], patterns: [/rent(al)? (payment|amount)|mortgage payment|monthly rent/] },
  {
    field: "vehicle_type",
    exact: ["vehicle", "vehicle type", "vehicle of interest", "car", "interested in"],
    // Meta question text, e.g. "what type of vehicle are you most interested in?"
    patterns: [/type of vehicle|vehicle type|what vehicle|kind of vehicle|vehicle.*interest|interest.*vehicle|looking for/],
  },
  {
    field: "monthly_budget",
    exact: ["budget", "monthly budget", "monthly payment", "payment"],
    patterns: [/budget|monthly payment|payment range|afford/],
  },
  { field: "down_payment", exact: ["down payment", "downpayment", "deposit"], patterns: [/down ?payment|deposit/] },
  { field: "trade_in_year", exact: ["trade in year", "trade-in year"], patterns: [/trade.?in.*year/] },
  { field: "trade_in_make", exact: ["trade in make", "trade-in make"], patterns: [/trade.?in.*make/] },
  { field: "trade_in_model", exact: ["trade in model", "trade-in model"], patterns: [/trade.?in.*model/] },
  { field: "has_trade_in", exact: ["trade in", "trade-in", "tradein"], patterns: [/trade.?in/] },
  { field: "credit_rating", exact: ["credit", "credit rating", "credit score"], patterns: [/credit/] },
  {
    field: "employment_status",
    exact: ["employment", "employment status", "work status"],
    patterns: [/employment|employed|work status/],
  },
  {
    field: "income_amount",
    exact: ["income", "monthly income", "annual income", "salary"],
    patterns: [/income|salary|earn/],
  },
  { field: "employer_name", exact: ["employer", "employer name", "company"], patterns: [/employer|company name|where do you work/] },
  { field: "job_title", exact: ["job title", "jobtitle", "occupation", "position", "role"], patterns: [/job title|occupation|position|what do you do/] },
  {
    field: "has_drivers_licence",
    exact: ["licence", "license", "drivers licence", "driver's licence", "drivers license", "driver's license"],
    patterns: [/licen[cs]e/],
  },
  { field: "preferred_contact", exact: ["preferred contact", "best way to contact", "contact preference"], patterns: [/preferred contact|best way to (be )?contact|contact method/] },
  { field: "notes", exact: ["notes", "message", "comments", "details"], patterns: [/\bnotes?\b|\bmessage\b|comments/] },
];


/** Meta / Facebook Lead Ads export columns -> campaign metadata */
const CAMPAIGN_ALIASES: Record<string, string[]> = {
  lead_id: ["id", "lead id"],
  created_time: ["created time", "created_time", "date created", "submitted at"],
  ad_name: ["ad name", "ad"],
  ad_id: ["ad id"],
  adset_name: ["adset name", "ad set name", "adset"],
  adset_id: ["adset id", "ad set id"],
  campaign_name: ["campaign name", "campaign"],
  campaign_id: ["campaign id"],
  form_name: ["form name", "form"],
  form_id: ["form id"],
  platform: ["platform", "publisher platform"],
  is_organic: ["is organic", "organic"],
  lead_status: ["lead status", "status"],
};

const PLATFORM_LABELS: Record<string, string> = {
  fb: "Facebook Lead Ad",
  facebook: "Facebook Lead Ad",
  ig: "Instagram Lead Ad",
  instagram: "Instagram Lead Ad",
  an: "Meta Audience Network Lead Ad",
  msg: "Messenger Lead Ad",
};

function normKey(k: string) {
  return k.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/** Meta prefixes ids/phones like "l:1234", "c:1234", "p:+1778..." */
function stripPrefix(v: string) {
  return v.replace(/^(l|ag|as|c|f|p|a):/i, "").trim();
}

function mapRow(row: Record<string, unknown>) {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    const val = String(v).trim();
    if (!val) continue;
    flat[normKey(k)] = val;
  }

  const usedKeys = new Set<string>();
  const campaign: Record<string, string> = {};
  for (const [field, keys] of Object.entries(CAMPAIGN_ALIASES)) {
    for (const key of keys) {
      if (flat[key] && !usedKeys.has(key)) {
        campaign[field] = stripPrefix(flat[key]);
        usedKeys.add(key);
        break;
      }
    }
  }

  const out: Record<string, string> = {};
  // Pass 1: exact header matches. Pass 2: loose pattern matches on whatever's left.
  for (const m of MATCHERS) {
    for (const key of m.exact) {
      if (flat[key] && !usedKeys.has(key)) {
        out[m.field] = stripPrefix(flat[key]);
        usedKeys.add(key);
        break;
      }
    }
  }
  for (const m of MATCHERS) {
    if (out[m.field] || !m.patterns) continue;
    for (const key of Object.keys(flat)) {
      if (usedKeys.has(key)) continue;
      if (m.patterns.some((p) => p.test(key))) {
        out[m.field] = stripPrefix(flat[key]);
        usedKeys.add(key);
        break;
      }
    }
  }

  // "Full name" style single column -> split
  if (out.first_name && !out.last_name && /\s/.test(out.first_name)) {
    const parts = out.first_name.split(/\s+/);
    out.first_name = parts.shift() as string;
    out.last_name = parts.join(" ");
  }

  // Anything unmapped goes into notes so nothing is lost
  const leftovers = Object.entries(flat)
    .filter(([k]) => !usedKeys.has(k))
    .map(([k, v]) => `${k}: ${v}`);
  if (leftovers.length) {
    out.notes = [out.notes, leftovers.join(" | ")].filter(Boolean).join(" | ");
  }
  return { out, campaign };
}



export const Route = createFileRoute("/api/public/hooks/sheet-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SHEET_LEAD_TOKEN;
        if (!expected) return new Response("Not configured", { status: 503 });

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const parsed = PayloadSchema.safeParse(raw);
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });

        const token = request.headers.get("x-sheet-token") ?? parsed.data.token ?? "";
        if (token !== expected) return new Response("Unauthorized", { status: 401 });

        const { token: _t, row, source, ...explicit } = parsed.data;
        const rowResult = row ? mapRow(row) : { out: {}, campaign: {} };
        const campaign = rowResult.campaign;
        const mapped: Record<string, string> = {
          ...rowResult.out,
          ...(Object.fromEntries(Object.entries(explicit).filter(([, v]) => v)) as Record<string, string>),
        };

        if (![mapped.first_name, mapped.last_name].every((name) => OptionalPersonNameSchema.safeParse(name).success)) {
          return new Response(NAME_ERROR, { status: 422 });
        }

        const phoneDigits = (mapped.phone ?? "").replace(/\D/g, "");
        if (!mapped.first_name && !mapped.email && !phoneDigits) {
          return new Response("Row has no usable contact info", { status: 422 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { notes, ...leadFields } = mapped;
        const now = new Date().toISOString();
        const platformKey = (campaign.platform ?? "").toLowerCase();
        const isMeta = Boolean(campaign.campaign_name || campaign.form_name || platformKey);
        const channel = isMeta
          ? PLATFORM_LABELS[platformKey] ?? "Meta Lead Ad"
          : "Google Sheet import";
        const hasCampaign = Object.keys(campaign).length > 0;

        const { computeLeadScore } = await import("@/lib/lead-score");
        const insertRow = {
          ...leadFields,
          status: "partial",
          source: source || "google_sheet",
          attribution_channel: channel,
          utm_source: isMeta ? (platformKey === "ig" ? "instagram" : "facebook") : null,
          utm_medium: isMeta ? "paid_social" : null,
          utm_campaign: campaign.campaign_name || null,
          utm_content: campaign.ad_name || null,
          utm_term: campaign.adset_name || null,
          completion_pct: 20,
          current_step: "sheet_import",
          submitted_at: now,
          last_activity_at: now,
          extra:
            notes || hasCampaign
              ? { ...(notes ? { sheet_notes: notes } : {}), ...(hasCampaign ? { campaign } : {}) }
              : null,
        } as Record<string, unknown>;
        insertRow.lead_score = computeLeadScore(insertRow);

        const { data: lead, error } = await supabaseAdmin
          .from("leads")
          .insert(insertRow as never)
          .select("*")
          .maybeSingle();


        if (error || !lead) {
          console.error("[sheet-lead] insert failed", error);
          return new Response("Insert failed", { status: 500 });
        }

        if ((lead as { duplicate_of?: string | null }).duplicate_of) {
          return Response.json({
            ok: true,
            skipped: "duplicate",
            id: lead.id,
            duplicate_of: (lead as { duplicate_of: string }).duplicate_of,
          });
        }

        try {
          const { notifyLeadSubmission } = await import("@/lib/leads-notify.server");
          await notifyLeadSubmission(
            lead as Record<string, unknown>,
            `sheet-${lead.id}`,
            null,
            null,
            { force: true, skipCapi: true },
          );
          await supabaseAdmin
            .from("leads")
            .update({ email_notified_at: new Date().toISOString() })
            .eq("id", lead.id);
        } catch (e) {
          console.error("[sheet-lead] notify failed", e);
        }

        try {
          const { autoDeliverLead } = await import("@/lib/lead-delivery.server");
          await autoDeliverLead(lead as Record<string, unknown>);
        } catch (e) {
          console.error("[sheet-lead] auto-deliver failed", e);
        }


        return Response.json({ ok: true, id: lead.id });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "content-type, x-sheet-token",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
        }),
    },
  },
});
