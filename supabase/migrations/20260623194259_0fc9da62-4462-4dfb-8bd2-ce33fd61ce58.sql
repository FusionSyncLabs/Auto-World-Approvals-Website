DROP POLICY IF EXISTS "Public reads branding settings" ON public.app_settings;
CREATE POLICY "Public reads branding settings" ON public.app_settings
FOR SELECT TO public
USING (key = ANY (ARRAY['favicon_url','logo_url','logo_url_light','logo_url_dark','happy_clients_enabled']));