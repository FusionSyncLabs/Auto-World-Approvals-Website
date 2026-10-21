import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CrmLayout } from "@/components/crm/CrmLayout";

async function loadRole() {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  const roles = (data ?? []).map((r) => (r as { role: string }).role);
  if (roles.includes("superadmin")) return "superadmin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("agent")) return "agent";
  return null;
}

export const Route = createFileRoute("/_authenticated/crm")({
  beforeLoad: async () => {
    const role = await loadRole();
    if (!role) throw redirect({ to: "/" });
    return { crmRole: role };
  },
  component: CrmRoot,
});

function CrmRoot() {
  const { data: role } = useQuery({ queryKey: ["crm-role"], queryFn: loadRole, staleTime: 60_000 });
  return (
    <CrmLayout role={role ?? undefined}>
      <Outlet />
    </CrmLayout>
  );
}
