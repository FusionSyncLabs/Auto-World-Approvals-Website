import { getCookie } from "@tanstack/react-start/server";
import { META_ELIGIBILITY_VERIFIED, canSendAdvertising } from "./ad-policy";
import { isProductionHost } from "./prod-host";

/** Checks the event-time choice and the latest choice; unknown evidence fails closed. */
export async function permittedAdvertising(recordId: string | null | undefined, productionHost: string | null) {
  if (!recordId || !isProductionHost(productionHost)) return false;
  const visitor = getCookie("awa_consent_visitor");
  if (!visitor) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: atEvent } = await supabaseAdmin.from("advertising_consent_records").select("visitor_token,advertising").eq("id", recordId).maybeSingle();
  if (!atEvent || atEvent.visitor_token !== visitor) return false;
  const { data: latest } = await supabaseAdmin.from("advertising_consent_records").select("advertising").eq("visitor_token", visitor).order("captured_at", { ascending: false }).limit(1).maybeSingle();
  return canSendAdvertising({ production: true, accepted: atEvent.advertising, currentAccepted: latest?.advertising === true, eligible: META_ELIGIBILITY_VERIFIED });
}