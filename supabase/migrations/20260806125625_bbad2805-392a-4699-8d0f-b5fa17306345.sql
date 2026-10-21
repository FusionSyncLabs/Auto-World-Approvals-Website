CREATE OR REPLACE FUNCTION public.compute_lead_score(l public.leads)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT (
      (CASE WHEN coalesce(l.city,'') <> '' OR coalesce(l.province,'') <> '' OR coalesce(l.postal_code,'') <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN coalesce(l.vehicle_type,'') <> '' THEN 8 ELSE 0 END)
    + (CASE WHEN coalesce(l.monthly_budget,'') <> '' THEN 7 ELSE 0 END)
    + (CASE WHEN coalesce(l.credit_rating,'') <> '' THEN 10 ELSE 0 END)
    + (CASE WHEN coalesce(l.employment_status,'') <> '' OR coalesce(l.income_amount,'') <> '' THEN 10 ELSE 0 END)
    + (CASE WHEN coalesce(l.has_trade_in,'') <> '' OR coalesce(l.employment_length,'') <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN coalesce(l.residence_status,'') <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN coalesce(l.has_drivers_licence,'') <> '' OR l.date_of_birth IS NOT NULL OR coalesce(l.street_address,'') <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN l.consent_credit_check THEN 5 ELSE 0 END)
    ) AS qual
  )
  SELECT LEAST(100, GREATEST(0,
      (CASE WHEN coalesce(l.first_name,'') <> '' AND coalesce(l.phone,'') <> '' THEN 15 ELSE 0 END)
    + (CASE WHEN coalesce(l.last_name,'') <> '' THEN 3 ELSE 0 END)
    + (CASE WHEN coalesce(l.email,'') <> '' THEN 7 ELSE 0 END)
    + q.qual
    + (CASE WHEN q.qual > 0 AND (l.submitted_at IS NOT NULL OR l.status IN ('new','submitted','contacted','qualified','sent_to_dealer','approved','sold')) THEN 10 ELSE 0 END)
  )) FROM q;
$$;
REVOKE EXECUTE ON FUNCTION public.compute_lead_score(public.leads) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_lead_score(public.leads) TO authenticated, service_role;

UPDATE public.leads l SET lead_score = public.compute_lead_score(l.*);