
-- 1. CRM contacts library
CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crm_contacts_email_key ON public.crm_contacts (lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users read contacts" ON public.crm_contacts FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'agent'));
CREATE POLICY "CRM users write contacts" ON public.crm_contacts FOR INSERT TO authenticated
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'agent'));
CREATE POLICY "CRM users update contacts" ON public.crm_contacts FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'agent'))
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'agent'));
CREATE POLICY "CRM users delete contacts" ON public.crm_contacts FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'agent'));

-- 2. Lead send log
CREATE TABLE public.lead_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_sends_lead_id_idx ON public.lead_sends (lead_id);
GRANT SELECT, INSERT ON public.lead_sends TO authenticated;
GRANT ALL ON public.lead_sends TO service_role;
ALTER TABLE public.lead_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users read sends" ON public.lead_sends FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'agent'));
CREATE POLICY "CRM users write sends" ON public.lead_sends FOR INSERT TO authenticated
  WITH CHECK ((private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'agent')) AND sent_by = auth.uid());

-- 3. Agent access to leads and notes
CREATE POLICY "Agents read leads" ON public.leads FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'agent'));
CREATE POLICY "Agents update leads" ON public.leads FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'agent'))
  WITH CHECK (private.has_role(auth.uid(), 'agent'));
CREATE POLICY "Agents read notes" ON public.lead_notes FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'agent'));
CREATE POLICY "Agents write notes" ON public.lead_notes FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'agent') AND author_id = auth.uid());

-- 4. Shared lead score
CREATE OR REPLACE FUNCTION public.compute_lead_score(l public.leads)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT LEAST(100, GREATEST(0,
      (CASE WHEN coalesce(l.first_name,'') <> '' AND coalesce(l.phone,'') <> '' THEN 25 ELSE 0 END)
    + (CASE WHEN coalesce(l.last_name,'') <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN coalesce(l.email,'') <> '' THEN 10 ELSE 0 END)
    + (CASE WHEN coalesce(l.city,'') <> '' OR coalesce(l.province,'') <> '' OR coalesce(l.postal_code,'') <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN coalesce(l.vehicle_type,'') <> '' THEN 8 ELSE 0 END)
    + (CASE WHEN coalesce(l.monthly_budget,'') <> '' THEN 7 ELSE 0 END)
    + (CASE WHEN coalesce(l.credit_rating,'') <> '' THEN 10 ELSE 0 END)
    + (CASE WHEN coalesce(l.employment_status,'') <> '' OR coalesce(l.income_amount,'') <> '' THEN 10 ELSE 0 END)
    + (CASE WHEN coalesce(l.has_trade_in,'') <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN coalesce(l.residence_status,'') <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN coalesce(l.has_drivers_licence,'') <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN l.consent_credit_check THEN 5 ELSE 0 END)
    + (CASE WHEN l.submitted_at IS NOT NULL OR l.status IN ('new','submitted','contacted','qualified','sent_to_dealer','approved','sold') THEN 10 ELSE 0 END)
  ));
$$;
REVOKE EXECUTE ON FUNCTION public.compute_lead_score(public.leads) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_lead_score(public.leads) TO authenticated, service_role;

UPDATE public.leads l SET lead_score = public.compute_lead_score(l.*);
