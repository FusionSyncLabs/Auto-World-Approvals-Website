-- A lead can have exactly one paying-client owner across all distribution lists.
-- Remove any impossible cross-list duplicates deterministically before adding
-- the stronger invariant (the oldest assignment remains authoritative).
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY lead_id ORDER BY created_at, id) AS rn
  FROM public.lead_distribution_assignments
)
DELETE FROM public.lead_distribution_assignments a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

ALTER TABLE public.lead_distribution_assignments
  DROP CONSTRAINT IF EXISTS lead_distribution_assignments_lead_id_list_id_key;

ALTER TABLE public.lead_distribution_assignments
  ADD CONSTRAINT lead_distribution_assignments_lead_id_key UNIQUE (lead_id);

CREATE OR REPLACE FUNCTION public.assign_rotation_contact(_list_id uuid, _lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigned_id uuid;
  assigned_list_id uuid;
  last_id uuid;
  pinned_id uuid;
BEGIN
  -- Serialize every assignment attempt for this lead, including attempts that
  -- evaluated a different geographic list in another concurrent request.
  PERFORM pg_advisory_xact_lock(hashtextextended(_lead_id::text, 0));

  SELECT contact_id, list_id
    INTO assigned_id, assigned_list_id
    FROM public.lead_distribution_assignments
   WHERE lead_id = _lead_id;

  IF assigned_id IS NOT NULL THEN
    -- The first confirmed paying-client assignment owns the lead permanently.
    RETURN assigned_id;
  END IF;

  SELECT last_assigned_contact_id, next_contact_id
    INTO last_id, pinned_id
    FROM public.distribution_lists
   WHERE id = _list_id
     AND is_active
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF pinned_id IS NOT NULL THEN
    SELECT c.id INTO assigned_id
      FROM public.lead_delivery_contacts c
     WHERE c.id = pinned_id
       AND c.list_id = _list_id
       AND c.kind = 'client'
       AND c.is_active;
  END IF;

  IF assigned_id IS NULL THEN
    WITH ordered AS (
      SELECT c.id,
             row_number() OVER (ORDER BY c.rotation_order, c.created_at, c.id) AS rn
        FROM public.lead_delivery_contacts c
       WHERE c.list_id = _list_id
         AND c.kind = 'client'
         AND c.is_active
    ), cur AS (
      SELECT rn FROM ordered WHERE id = last_id
    )
    SELECT id INTO assigned_id
      FROM ordered
     WHERE rn > COALESCE((SELECT rn FROM cur), 0)
     ORDER BY rn
     LIMIT 1;

    IF assigned_id IS NULL THEN
      SELECT c.id INTO assigned_id
        FROM public.lead_delivery_contacts c
       WHERE c.list_id = _list_id
         AND c.kind = 'client'
         AND c.is_active
       ORDER BY c.rotation_order, c.created_at, c.id
       LIMIT 1;
    END IF;
  END IF;

  IF assigned_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.lead_distribution_assignments (lead_id, list_id, contact_id)
  VALUES (_lead_id, _list_id, assigned_id)
  ON CONFLICT (lead_id) DO NOTHING;

  SELECT contact_id, list_id
    INTO assigned_id, assigned_list_id
    FROM public.lead_distribution_assignments
   WHERE lead_id = _lead_id;

  -- Only the list that actually won ownership advances its pointer.
  IF assigned_list_id = _list_id THEN
    UPDATE public.distribution_lists
       SET last_assigned_contact_id = assigned_id,
           next_contact_id = NULL,
           updated_at = now()
     WHERE id = _list_id;
  END IF;

  RETURN assigned_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_rotation_contact(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_rotation_contact(uuid, uuid) TO service_role;