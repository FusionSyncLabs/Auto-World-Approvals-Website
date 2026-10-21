ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_detected_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_duplicate_of_idx
  ON public.leads (duplicate_of)
  WHERE duplicate_of IS NOT NULL;

ALTER TABLE public.lead_delivery_contacts
  ADD COLUMN IF NOT EXISTS is_first_contact boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS lead_delivery_contacts_one_first_contact
  ON public.lead_delivery_contacts (is_first_contact)
  WHERE is_first_contact = true;

CREATE OR REPLACE FUNCTION public.mark_duplicate_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text;
  normalized_phone text;
  original_id uuid;
BEGIN
  IF NEW.duplicate_of IS NOT NULL THEN
    NEW.status := 'duplicate';
    NEW.duplicate_detected_at := COALESCE(NEW.duplicate_detected_at, now());
    RETURN NEW;
  END IF;

  normalized_email := NULLIF(lower(btrim(COALESCE(NEW.email, ''))), '');
  normalized_phone := NULLIF(regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g'), '');
  IF normalized_phone IS NOT NULL AND length(normalized_phone) = 11 AND normalized_phone LIKE '1%' THEN
    normalized_phone := substr(normalized_phone, 2);
  END IF;

  IF normalized_email IS NULL AND (normalized_phone IS NULL OR length(normalized_phone) < 10) THEN
    RETURN NEW;
  END IF;

  -- Serialize submissions for the same identity so simultaneous webhooks or
  -- form submissions cannot both become canonical leads.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(COALESCE(normalized_phone, '') || '|' || COALESCE(normalized_email, ''), 0)
  );

  SELECT l.id
    INTO original_id
    FROM public.leads l
   WHERE l.id <> NEW.id
     AND l.duplicate_of IS NULL
     AND (
       (normalized_email IS NOT NULL AND lower(btrim(COALESCE(l.email, ''))) = normalized_email)
       OR
       (normalized_phone IS NOT NULL AND length(normalized_phone) >= 10 AND
         CASE
           WHEN length(regexp_replace(COALESCE(l.phone, ''), '[^0-9]', '', 'g')) = 11
             AND regexp_replace(COALESCE(l.phone, ''), '[^0-9]', '', 'g') LIKE '1%'
           THEN substr(regexp_replace(COALESCE(l.phone, ''), '[^0-9]', '', 'g'), 2)
           ELSE regexp_replace(COALESCE(l.phone, ''), '[^0-9]', '', 'g')
         END = normalized_phone)
     )
   ORDER BY l.created_at ASC
   LIMIT 1;

  IF original_id IS NOT NULL THEN
    NEW.duplicate_of := original_id;
    NEW.duplicate_detected_at := COALESCE(NEW.duplicate_detected_at, now());
    NEW.status := 'duplicate';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_duplicate_lead() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_duplicate_lead() TO service_role;

DROP TRIGGER IF EXISTS trg_leads_mark_duplicate ON public.leads;
CREATE TRIGGER trg_leads_mark_duplicate
  BEFORE INSERT OR UPDATE OF email, phone, status, duplicate_of
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_duplicate_lead();