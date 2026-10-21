CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('superadmin', 'admin')
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO anon, authenticated, service_role;

ALTER POLICY "Admins read settings" ON public.app_settings
  USING (private.is_admin(auth.uid()));
ALTER POLICY "Superadmins write settings" ON public.app_settings
  USING (private.has_role(auth.uid(), 'superadmin'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'superadmin'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins read audit" ON public.audit_log
  USING (private.is_admin(auth.uid()));
ALTER POLICY "Admins write audit" ON public.audit_log
  WITH CHECK (private.is_admin(auth.uid()) AND auth.uid() = actor_id);

ALTER POLICY "Admins manage posts" ON public.blog_posts
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'superadmin'::public.app_role));
ALTER POLICY "Anyone reads published posts" ON public.blog_posts
  USING (status = 'published'::text OR private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'superadmin'::public.app_role));

ALTER POLICY "Admins delete brand assets" ON public.brand_assets
  USING (private.is_admin(auth.uid()));
ALTER POLICY "Admins read brand assets" ON public.brand_assets
  USING (private.is_admin(auth.uid()));
ALTER POLICY "Admins update brand assets" ON public.brand_assets
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "Admins write brand assets" ON public.brand_assets
  WITH CHECK (private.is_admin(auth.uid()));

ALTER POLICY "Admins can delete contact messages" ON public.contact_messages
  USING (private.is_admin(auth.uid()));
ALTER POLICY "Admins can update contact messages" ON public.contact_messages
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "Admins can view contact messages" ON public.contact_messages
  USING (private.is_admin(auth.uid()));

ALTER POLICY "Admins delete notes" ON public.lead_notes
  USING (private.is_admin(auth.uid()));
ALTER POLICY "Admins read notes" ON public.lead_notes
  USING (private.is_admin(auth.uid()));
ALTER POLICY "Admins write notes" ON public.lead_notes
  WITH CHECK (private.is_admin(auth.uid()) AND author_id = auth.uid());

ALTER POLICY "Admins delete leads" ON public.leads
  USING (private.has_role(auth.uid(), 'superadmin'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins read leads" ON public.leads
  USING (private.is_admin(auth.uid()));
ALTER POLICY "Admins update leads" ON public.leads
  USING (private.is_admin(auth.uid()));

ALTER POLICY "Admins manage legal docs" ON public.legal_documents
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'superadmin'::public.app_role));

ALTER POLICY "Admins manage site content" ON public.site_content
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'superadmin'::public.app_role));

ALTER POLICY "Superadmins manage roles" ON public.user_roles
  USING (private.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'superadmin'::public.app_role));

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;