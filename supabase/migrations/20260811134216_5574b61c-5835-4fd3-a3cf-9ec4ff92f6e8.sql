ALTER TABLE public.distribution_lists
  ADD COLUMN IF NOT EXISTS next_contact_id uuid REFERENCES public.lead_delivery_contacts(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.next_rotation_contact(_list_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  last_id uuid;
  pinned_id uuid;
  next_id uuid;
BEGIN
  SELECT last_assigned_contact_id, next_contact_id
    INTO last_id, pinned_id
    FROM public.distribution_lists
   WHERE id = _list_id
   FOR UPDATE;

  IF pinned_id IS NOT NULL THEN
    SELECT c.id INTO next_id
      FROM public.lead_delivery_contacts c
     WHERE c.id = pinned_id AND c.list_id = _list_id AND c.is_active;
  END IF;

  IF next_id IS NULL THEN
    WITH ordered AS (
      SELECT c.id, row_number() OVER (ORDER BY c.rotation_order, c.created_at, c.id) AS rn
        FROM public.lead_delivery_contacts c
       WHERE c.list_id = _list_id AND c.is_active
    ), cur AS (
      SELECT rn FROM ordered WHERE id = last_id
    )
    SELECT id INTO next_id FROM ordered
     WHERE rn > COALESCE((SELECT rn FROM cur), 0)
     ORDER BY rn LIMIT 1;

    IF next_id IS NULL THEN
      SELECT c.id INTO next_id
        FROM public.lead_delivery_contacts c
       WHERE c.list_id = _list_id AND c.is_active
       ORDER BY c.rotation_order, c.created_at, c.id
       LIMIT 1;
    END IF;
  END IF;

  IF next_id IS NOT NULL THEN
    UPDATE public.distribution_lists
       SET last_assigned_contact_id = next_id,
           next_contact_id = NULL,
           updated_at = now()
     WHERE id = _list_id;
  END IF;

  RETURN next_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.next_rotation_contact(uuid) FROM anon, authenticated;