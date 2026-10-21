ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_kind_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_kind_check CHECK (kind = ANY (ARRAY[
  'logo_generate'::text,
  'logo_remix'::text,
  'logo_upload'::text,
  'banner_variations'::text,
  'banner_remix'::text,
  'ad_generate'::text,
  'ad_remix'::text,
  'happy_client_generate'::text,
  'happy_client_regenerate'::text
]));