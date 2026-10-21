
ALTER TABLE public.brand_assets DROP CONSTRAINT IF EXISTS brand_assets_kind_check;
ALTER TABLE public.brand_assets ADD CONSTRAINT brand_assets_kind_check
  CHECK (kind = ANY (ARRAY[
    'logo'::text,
    'banner'::text,
    'happy_client'::text,
    'ad_competitor_ref'::text,
    'ad_client_photo'::text,
    'ad_generated'::text
  ]));

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_kind_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_kind_check
  CHECK (kind = ANY (ARRAY[
    'logo_generate'::text,
    'logo_remix'::text,
    'logo_upload'::text,
    'banner_variations'::text,
    'banner_remix'::text,
    'ad_generate'::text,
    'ad_remix'::text
  ]));
