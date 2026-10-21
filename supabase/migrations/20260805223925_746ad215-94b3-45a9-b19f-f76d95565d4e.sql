ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS first_contact_by text,
  ADD COLUMN IF NOT EXISTS first_contact_source text;

CREATE INDEX IF NOT EXISTS lead_sends_recipient_email_idx ON public.lead_sends (recipient_email);