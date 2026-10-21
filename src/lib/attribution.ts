/**
 * First-touch marketing attribution.
 *
 * Captured on the very first page the visitor lands on (anywhere on the site),
 * stored in localStorage, and attached to every lead they later submit — so a
 * visitor who arrives from a Google Ad on the homepage and applies three pages
 * later is still credited to that ad.
 */

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  referrer?: string;
  landing_page?: string;
  device?: string;
}

const STORAGE_KEY = "aw_attr";

const CLICK_IDS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid"] as const;

/**
 * Human-readable channel label, derived from click IDs first (most reliable),
 * then UTMs, then the referring domain.
 */
export function deriveChannel(a: Attribution): string {
  const src = (a.utm_source || "").toLowerCase();
  const med = (a.utm_medium || "").toLowerCase();
  const ref = (a.referrer || "").toLowerCase();

  if (a.gclid) return "Google Ads (paid search)";
  if (a.msclkid) return "Microsoft/Bing Ads (paid search)";
  if (a.fbclid) {
    return med.includes("cpc") || med.includes("paid") || src.includes("ad")
      ? "Facebook/Instagram Ads (paid social)"
      : "Facebook/Instagram (click)";
  }

  const paidMedium = /cpc|ppc|paid|display|paidsocial|paid_social/.test(med);
  if (src) {
    if (src.includes("google")) return paidMedium ? "Google Ads (paid search)" : "Google (organic/other)";
    if (src.includes("facebook") || src.includes("meta") || src.includes("instagram") || src.includes("fb"))
      return paidMedium ? "Facebook/Instagram Ads (paid social)" : "Facebook/Instagram (organic)";
    if (src.includes("bing")) return paidMedium ? "Microsoft/Bing Ads" : "Bing (organic)";
    if (src.includes("tiktok")) return paidMedium ? "TikTok Ads" : "TikTok (organic)";
    return `${a.utm_source}${med ? ` / ${a.utm_medium}` : ""}`;
  }

  if (ref) {
    if (/google\./.test(ref)) return "Google organic search";
    if (/bing\.|duckduckgo\.|yahoo\./.test(ref)) return "Other organic search";
    if (/facebook\.|instagram\.|fb\.com|m\.facebook/.test(ref)) return "Facebook/Instagram (organic)";
    if (/tiktok\./.test(ref)) return "TikTok (organic)";
    if (/youtube\./.test(ref)) return "YouTube";
    try {
      return `Referral — ${new URL(a.referrer!).hostname.replace(/^www\./, "")}`;
    } catch {
      return "Referral";
    }
  }

  return "Direct / unknown";
}

function readCurrent(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => params.get(k) || undefined;
  const clickIds: Record<string, string | undefined> = {};
  for (const id of CLICK_IDS) clickIds[id] = get(id);

  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_term: get("utm_term"),
    utm_content: get("utm_content"),
    // gbraid/wbraid are Google click IDs used when cookies are restricted.
    gclid: clickIds.gclid || clickIds.gbraid || clickIds.wbraid,
    fbclid: clickIds.fbclid,
    msclkid: clickIds.msclkid,
    referrer: document.referrer || undefined,
    landing_page: window.location.pathname + window.location.search,
    device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
  };
}

function hasSignal(a: Attribution): boolean {
  return Boolean(a.utm_source || a.utm_medium || a.gclid || a.fbclid || a.msclkid || a.referrer);
}

/** Call once on app mount. Stores the first-touch attribution if not already set. */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const current = readCurrent();
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      return;
    }
    // A later visit with an explicit campaign/click ID overwrites a weaker
    // first touch (e.g. direct) so paid clicks are never lost.
    const prev = JSON.parse(stored) as Attribution;
    if (!hasSignal(prev) && hasSignal(current)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
  } catch {
    /* storage unavailable — attribution falls back to the live URL */
  }
}

/** Tracking payload to attach to a lead submission. */
export function getTracking(): Attribution & { channel: string } {
  if (typeof window === "undefined") return { channel: "Direct / unknown" };
  let attr: Attribution;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    attr = stored ? (JSON.parse(stored) as Attribution) : readCurrent();
  } catch {
    attr = readCurrent();
  }
  const live = readCurrent();
  // Prefer stored first-touch values, but never lose a signal present right now.
  const merged: Attribution = { ...live, ...Object.fromEntries(Object.entries(attr).filter(([, v]) => v)) };
  if (!merged.device) merged.device = live.device;
  return { ...merged, channel: deriveChannel(merged) };
}
