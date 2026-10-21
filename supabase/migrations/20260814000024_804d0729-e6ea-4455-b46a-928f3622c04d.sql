ALTER TABLE public.lead_sends
  ADD COLUMN IF NOT EXISTS excluded_from_count boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusion_reason text;

CREATE INDEX IF NOT EXISTS lead_sends_recipient_sent_idx
  ON public.lead_sends (lower(recipient_email), sent_at);