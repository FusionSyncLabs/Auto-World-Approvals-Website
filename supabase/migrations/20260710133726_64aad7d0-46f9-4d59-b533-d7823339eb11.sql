
-- Move happy_clients policies to use private.is_admin so we can revoke public.is_admin execution
DROP POLICY IF EXISTS "Admins can update happy clients" ON public.happy_clients;
DROP POLICY IF EXISTS "Admins can delete happy clients" ON public.happy_clients;
DROP POLICY IF EXISTS "Signed-in users can view active clients and admins can view all" ON public.happy_clients;

CREATE POLICY "Admins can update happy clients" ON public.happy_clients
  FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY "Admins can delete happy clients" ON public.happy_clients
  FOR DELETE TO authenticated USING (private.is_admin(auth.uid()));
CREATE POLICY "Signed-in users can view active clients and admins can view all" ON public.happy_clients
  FOR SELECT TO authenticated USING ((is_active = true) OR private.is_admin(auth.uid()));

-- Revoke EXECUTE on public SECURITY DEFINER functions from anon/authenticated/PUBLIC.
-- RLS policies reference private.* copies, so public.* variants don't need to be callable.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_job_worker() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reap_stuck_jobs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
