import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminRole = "superadmin" | "admin" | "agent" | "viewer";

export async function requireAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["superadmin", "admin"])
    .limit(1);

  if (error) {
    console.error("[admin-auth] role lookup failed", error.message);
    throw new Error("Role check failed");
  }
  if (!data?.length) throw new Error("Forbidden");

  return supabaseAdmin;
}

export async function requireSuperadmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .limit(1);

  if (error) {
    console.error("[admin-auth] superadmin lookup failed", error.message);
    throw new Error("Role check failed");
  }
  if (!data?.length) throw new Error("Forbidden: superadmin only");

  return supabaseAdmin;
}