CREATE TABLE public.lead_distribution_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.distribution_lists(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.lead_delivery_contacts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, list_id)
);

GRANT ALL ON public.lead_distribution_assignments TO service_role;
ALTER TABLE public.lead_distribution_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.assign_rotation_contact(_list_id uuid, _lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_id uuid;
  last_id uuid;
  pinned_id uuid;
BEGIN
  SELECT contact_id INTO assigned_id
    FROM public.lead_distribution_assignments
   WHERE lead_id = _lead_id AND list_id = _list_id;
  IF assigned_id IS NOT NULL THEN
    RETURN assigned_id;
  END IF;

  SELECT last_assigned_contact_id, next_contact_id
    INTO last_id, pinned_id
    FROM public.distribution_lists
   WHERE id = _list_id
   FOR UPDATE;

  SELECT contact_id INTO assigned_id
    FROM public.lead_distribution_assignments
   WHERE lead_id = _lead_id AND list_id = _list_id;
  IF assigned_id IS NOT NULL THEN
    RETURN assigned_id;
  END IF;

  IF pinned_id IS NOT NULL THEN
    SELECT c.id INTO assigned_id
      FROM public.lead_delivery_contacts c
     WHERE c.id = pinned_id AND c.list_id = _list_id AND c.is_active;
  END IF;

  IF assigned_id IS NULL THEN
    WITH ordered AS (
      SELECT c.id, row_number() OVER (ORDER BY c.rotation_order, c.created_at, c.id) AS rn
        FROM public.lead_delivery_contacts c
       WHERE c.list_id = _list_id AND c.is_active
    ), cur AS (
      SELECT rn FROM ordered WHERE id = last_id
    )
    SELECT id INTO assigned_id FROM ordered
     WHERE rn > COALESCE((SELECT rn FROM cur), 0)
     ORDER BY rn LIMIT 1;

    IF assigned_id IS NULL THEN
      SELECT c.id INTO assigned_id
        FROM public.lead_delivery_contacts c
       WHERE c.list_id = _list_id AND c.is_active
       ORDER BY c.rotation_order, c.created_at, c.id
       LIMIT 1;
    END IF;
  END IF;

  IF assigned_id IS NOT NULL THEN
    INSERT INTO public.lead_distribution_assignments (lead_id, list_id, contact_id)
    VALUES (_lead_id, _list_id, assigned_id)
    ON CONFLICT (lead_id, list_id) DO NOTHING;

    SELECT contact_id INTO assigned_id
      FROM public.lead_distribution_assignments
     WHERE lead_id = _lead_id AND list_id = _list_id;

    UPDATE public.distribution_lists
       SET last_assigned_contact_id = assigned_id,
           next_contact_id = NULL,
           updated_at = now()
     WHERE id = _list_id;
  END IF;

  RETURN assigned_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_rotation_contact(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_rotation_contact(uuid, uuid) TO service_role;

INSERT INTO public.lead_distribution_assignments (lead_id, list_id, contact_id)
SELECT l.id, dl.id, c.id
FROM public.leads l
JOIN public.distribution_lists dl ON dl.name = 'BC, AB Dealers'
JOIN public.lead_delivery_contacts c ON c.list_id = dl.id AND lower(c.email) = 'leebccredit@gmail.com'
WHERE lower(coalesce(l.first_name,'') || ' ' || coalesce(l.last_name,'')) = 'colleen rockenbach'
ON CONFLICT (lead_id, list_id) DO UPDATE SET contact_id = EXCLUDED.contact_id;

UPDATE public.distribution_lists dl
SET last_assigned_contact_id = c.id,
    next_contact_id = NULL,
    updated_at = now()
FROM public.lead_delivery_contacts c
WHERE dl.name = 'BC, AB Dealers'
  AND c.list_id = dl.id
  AND lower(c.email) = 'leebccredit@gmail.com';