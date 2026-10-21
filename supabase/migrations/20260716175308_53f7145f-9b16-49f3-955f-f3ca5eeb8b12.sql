ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email_notified_at timestamptz;
CREATE INDEX IF NOT EXISTS leads_email_notified_at_idx ON public.leads (email_notified_at);