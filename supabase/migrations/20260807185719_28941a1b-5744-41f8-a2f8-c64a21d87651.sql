ALTER TABLE public.lead_delivery_contacts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'client';

ALTER TABLE public.lead_delivery_contacts
  DROP CONSTRAINT IF EXISTS lead_delivery_contacts_kind_check;

ALTER TABLE public.lead_delivery_contacts
  ADD CONSTRAINT lead_delivery_contacts_kind_check CHECK (kind IN ('admin','client'));

UPDATE public.lead_delivery_contacts
  SET kind = 'admin'
  WHERE lower(email) = 'adam@autoworldapprovals.com';