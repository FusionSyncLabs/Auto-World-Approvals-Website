import { createHash } from "node:crypto";

const PIXEL_ID = process.env.META_PIXEL_ID ?? process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const TOKEN = process.env.META_CAPI_ACCESS_TOKEN ?? "";
const VERSION = process.env.META_GRAPH_VERSION ?? "v26.0";
const TEST_CODE = process.env.META_TEST_EVENT_CODE || undefined;

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export type MetaServerEvent = {
  eventName: "Lead" | "TradeInRequest" | "Contact";
  eventId: string; // same id the browser gets back
  sourceUrl: string; // e.g. https://autoworldapprovals.com/apply (no query string)
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  xid?: string | null; // raw aw_xid cookie, hashed below
};

export async function sendMetaEvent(e: MetaServerEvent): Promise<boolean> {
  if (!PIXEL_ID || !TOKEN) return false;
  const user_data: Record<string, unknown> = {};
  if (e.ip) user_data.client_ip_address = e.ip;
  if (e.userAgent) user_data.client_user_agent = e.userAgent;
  if (e.fbp) user_data.fbp = e.fbp;
  if (e.fbc) user_data.fbc = e.fbc;
  if (e.xid) user_data.external_id = [sha256(e.xid)];

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: e.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: "website",
        event_source_url: e.sourceUrl,
        user_data, // Matching parameters only; no financial or applicant answers
      },
    ],
    access_token: TOKEN,
  };
  if (TEST_CODE) body.test_event_code = TEST_CODE;

  try {
    const res = await fetch(`https://graph.facebook.com/${VERSION}/${PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[meta-capi]", res.status, await res.text());
    }
    return res.ok;
  } catch (err) {
    console.error("[meta-capi] error", err);
    return false;
  }
}

export const buildFbc = (fbclid?: string, firstSeenMs?: number) =>
  fbclid ? `fb.1.${firstSeenMs ?? Date.now()}.${fbclid}` : null;
