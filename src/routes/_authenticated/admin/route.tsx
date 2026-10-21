import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const roles = (data ?? []).map((r) => (r as { role: string }).role);
    if (roles.includes("superadmin") || roles.includes("admin")) return;
    if (roles.includes("agent")) throw redirect({ to: "/crm" });
    throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
