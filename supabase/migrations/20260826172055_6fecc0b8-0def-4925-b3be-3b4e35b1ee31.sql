DROP INDEX IF EXISTS public.lead_delivery_contacts_email_kind_key;

CREATE UNIQUE INDEX lead_delivery_contacts_email_kind_list_key
  ON public.lead_delivery_contacts (lower(email), kind, list_id)
  WHERE list_id IS NOT NULL;

CREATE UNIQUE INDEX lead_delivery_contacts_email_kind_nolist_key
  ON public.lead_delivery_contacts (lower(email), kind)
  WHERE list_id IS NULL;