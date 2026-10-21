
CREATE TABLE public.brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('logo','banner')),
  label text NOT NULL,
  variant text,
  palette text,
  platform text,
  prompt text,
  mime text NOT NULL DEFAULT 'image/png',
  data_base64 text NOT NULL,
  width int,
  height int,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_assets TO authenticated;
GRANT ALL ON public.brand_assets TO service_role;

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read brand assets" ON public.brand_assets
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins write brand assets" ON public.brand_assets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update brand assets" ON public.brand_assets
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete brand assets" ON public.brand_assets
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX brand_assets_kind_created_idx ON public.brand_assets (kind, created_at DESC);
