import { safeFunnelParams, safePagePath } from "./privacy-telemetry";
import { isProductionHost } from "@/lib/prod-host";

type Params = { step_number?: number; step_name?: string; form_variant?: string; error_code?: string };

/** Measurement register: the only GA4 events the site may send. */
export const GA_EVENTS = ["apply_cta_click", "vehicle_type_select", "application_start", "application_step_complete", "application_error", "generate_lead", "contact_submit"];

/**
 * GA4 funnel events. Only generic step identifiers are allowed — never
 * answers, location, income or contact details. Silent off production.
 */
export function trackGa(event: string, params: Params = {}): void {
  if (typeof window === "undefined" || !isProductionHost(window.location.hostname)) return;
  try {
    const prefs = JSON.parse(localStorage.getItem("awa-cookie-consent-v1") || "null");
    if (prefs?.version !== 2 || prefs?.analytics !== true) return;
  } catch { return; }
  const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (!GA_EVENTS.includes(event)) return;
  if (gtag) gtag("event", event, { ...safeFunnelParams(params), page_location: window.location.origin + safePagePath(window.location.pathname), page_referrer: "" });
}
