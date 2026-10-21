ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS cover_alt text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reading_minutes integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gen_notes text;

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON public.blog_posts (status, published_at DESC);

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_kind_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_kind_check CHECK (kind = ANY (ARRAY[
  'logo_generate','logo_remix','logo_upload','banner_variations','banner_remix',
  'ad_generate','ad_remix','happy_client_generate','happy_client_regenerate',
  'blog_generate','blog_rewrite','blog_image'
]));

INSERT INTO public.app_settings (key, value)
VALUES ('blog_autopilot', '{"enabled": false, "hour_local": 9, "days": [1,3,5], "posts_per_run": 1, "topics": "", "auto_publish": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

SELECT cron.schedule(
  'blog-autopilot',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://project--3bbed3f2-4626-49d8-ad35-1c296a2422ab.lovable.app/api/public/hooks/blog-autopilot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);