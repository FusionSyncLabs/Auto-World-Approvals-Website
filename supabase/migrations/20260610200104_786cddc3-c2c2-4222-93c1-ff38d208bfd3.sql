
-- 1) Narrow is_admin to admin/superadmin only
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('superadmin','admin'))
$$;

-- 2) Tighten app_settings public read → admin only
DROP POLICY IF EXISTS "Public read settings" ON public.app_settings;
CREATE POLICY "Admins read settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3) Tighten audit_log insert → require admin role
DROP POLICY IF EXISTS "Admins write audit" ON public.audit_log;
CREATE POLICY "Admins write audit"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = actor_id);

-- 4) Remove permissive public-insert policy on leads (server uses service role)
DROP POLICY IF EXISTS "Public can insert leads" ON public.leads;

-- 5) Allow admins to delete lead notes (in addition to authors)
DROP POLICY IF EXISTS "Admins delete notes" ON public.lead_notes;
CREATE POLICY "Admins delete notes"
  ON public.lead_notes FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6) Revoke direct EXECUTE on SECURITY DEFINER helpers (still callable from RLS)
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
