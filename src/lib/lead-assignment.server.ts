import { assignmentForEmail } from "./lead-assignment";

/** Read confirmed ownership, never first-contact or informational send rows. */
export async function getLeadEmailAssignment(leadId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("lead_distribution_assignments")
    .select("contact:lead_delivery_contacts(name,email),list:distribution_lists(name)")
    .eq("lead_id", leadId).maybeSingle();
  if (error) throw new Error("Unable to read confirmed lead assignment");
  return assignmentForEmail(data?.contact ?? null, data?.list?.name ?? null);
}