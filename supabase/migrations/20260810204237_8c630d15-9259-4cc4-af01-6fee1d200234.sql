CREATE TABLE public.distribution_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  provinces text[] NOT NULL DEFAULT '{}',
  cities text[] NOT NULL DEFAULT '{}',
  mode text NOT NULL DEFAULT 'round_robin',
  marks_contacted boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  last_assigned_contact_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT distribution_lists_mode_check CHECK (mode IN ('round_robin','all'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.distribution_lists TO authenticated;
GRANT ALL ON public.distribution_lists TO service_role;

ALTER TABLE public.distribution_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage distribution lists"
  ON public.distribution_lists FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_distribution_lists_updated
  BEFORE UPDATE ON public.distribution_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.lead_delivery_contacts
  ADD COLUMN list_id uuid REFERENCES public.distribution_lists(id) ON DELETE SET NULL,
  ADD COLUMN rotation_order integer NOT NULL DEFAULT 0;

CREATE INDEX idx_lead_delivery_contacts_list ON public.lead_delivery_contacts(list_id);

CREATE OR REPLACE FUNCTION public.next_rotation_contact(_list_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_id uuid;
  next_id uuid;
BEGIN
  SELECT last_assigned_contact_id INTO last_id
    FROM public.distribution_lists
   WHERE id = _list_id
   FOR UPDATE;

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

  IF next_id IS NOT NULL THEN
    UPDATE public.distribution_lists
       SET last_assigned_contact_id = next_id, updated_at = now()
     WHERE id = _list_id;
  END IF;

  RETURN next_id;
END;
$$;

REVOKE ALL ON FUNCTION public.next_rotation_contact(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_rotation_contact(uuid) TO service_role;