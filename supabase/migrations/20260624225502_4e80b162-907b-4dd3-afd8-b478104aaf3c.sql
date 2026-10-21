DROP POLICY IF EXISTS "Public can view active happy clients" ON public.happy_clients;
DROP POLICY IF EXISTS "Anyone can view active happy clients" ON public.happy_clients;
DROP POLICY IF EXISTS "Signed-in users can view active clients and admins can view all" ON public.happy_clients;

CREATE POLICY "Anyone can view active happy clients"
  ON public.happy_clients
  FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Signed-in users can view active clients and admins can view all"
  ON public.happy_clients
  FOR SELECT
  TO authenticated
  USING ((is_active = true) OR public.is_admin(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;