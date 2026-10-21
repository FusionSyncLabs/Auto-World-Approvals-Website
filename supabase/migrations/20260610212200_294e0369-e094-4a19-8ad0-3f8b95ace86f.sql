INSERT INTO public.app_settings (key, value) VALUES ('favicon_url', '""'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('logo_url', '""'::jsonb) ON CONFLICT (key) DO NOTHING;

CREATE POLICY "Public reads branding settings"
ON public.app_settings FOR SELECT
USING (key IN ('favicon_url','logo_url'));

GRANT SELECT ON public.app_settings TO anon;