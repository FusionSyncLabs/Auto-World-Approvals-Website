CREATE TABLE public.lead_delivery_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_delivery_contacts TO authenticated;
GRANT ALL ON public.lead_delivery_contacts TO service_role;

ALTER TABLE public.lead_delivery_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view delivery contacts"
  ON public.lead_delivery_contacts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));

CREATE POLICY "Team can manage delivery contacts"
  ON public.lead_delivery_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));

CREATE TRIGGER trg_lead_delivery_contacts_updated
  BEFORE UPDATE ON public.lead_delivery_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (key, value)
VALUES ('auto_deliver_leads', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;