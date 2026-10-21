
ALTER TABLE public.brand_assets DROP CONSTRAINT IF EXISTS brand_assets_kind_check;
ALTER TABLE public.brand_assets ADD CONSTRAINT brand_assets_kind_check
  CHECK (kind = ANY (ARRAY['logo'::text, 'banner'::text, 'happy_client'::text]));
