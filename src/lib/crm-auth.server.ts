import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CrmRole = "superadmin" | "admin" | "agent";

/**
 * Allows agents plus admins/superadmins into the CRM portal.
 * Returns the service client and the caller's highest role.
 */
export async function requireCrmUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["superadmin", "admin", "agent"]);

  if (error) {
    console.error("[crm-auth] role lookup failed", error.message);
    throw new Error("Role check failed");
  }
  const roles = (data ?? []).map((r) => (r as { role: CrmRole }).role);
  if (!roles.length) throw new Error("Forbidden");

  const role: CrmRole = roles.includes("superadmin")
    ? "superadmin"
    : roles.includes("admin")
      ? "admin"
      : "agent";

  return { supabaseAdmin, role, roles };
}
