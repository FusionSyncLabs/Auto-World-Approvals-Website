ALTER TABLE public.brand_assets DROP CONSTRAINT IF EXISTS brand_assets_kind_check;
ALTER TABLE public.brand_assets ADD CONSTRAINT brand_assets_kind_check CHECK (kind = ANY (ARRAY[
  'logo','banner','happy_client','ad_competitor_ref','ad_client_photo','ad_generated','favicon','hero','blog'
]));