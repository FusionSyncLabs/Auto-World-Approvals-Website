CREATE UNIQUE INDEX IF NOT EXISTS lead_sends_admin_unique ON public.lead_sends (lead_id, lower(recipient_email)) WHERE recipient_name = 'Admin copy';

ALTER TABLE public.lead_delivery_contacts DROP CONSTRAINT IF EXISTS lead_delivery_contacts_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS lead_delivery_contacts_email_kind_key ON public.lead_delivery_contacts (lower(email), kind);

INSERT INTO public.lead_delivery_contacts (name, email, kind, is_active, list_id, is_first_contact, rotation_order)
SELECT 'Admin (Adam)', 'adam@autoworldapprovals.com', 'admin', true, NULL, false, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_delivery_contacts
  WHERE lower(email) = 'adam@autoworldapprovals.com' AND kind = 'admin'
);