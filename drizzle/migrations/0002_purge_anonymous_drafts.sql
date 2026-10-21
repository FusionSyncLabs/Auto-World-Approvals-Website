CREATE OR REPLACE FUNCTION public.purge_anonymous_drafts() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.leads l
  WHERE l.status IN ('draft','partial')
    AND l.submitted_at IS NULL
    AND coalesce(trim(l.first_name),'') = ''
    AND coalesce(trim(l.phone),'') = ''
    AND coalesce(trim(l.email),'') = ''
    AND l.last_activity_at < now() - interval '24 hours'
    AND NOT EXISTS (SELECT 1 FROM public.lead_sends s WHERE s.lead_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.lead_distribution_assignments a WHERE a.lead_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.lead_notes x WHERE x.lead_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.leads d WHERE d.duplicate_of = l.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.purge_anonymous_drafts() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('purge-anonymous-drafts', '15 3 * * *', $$SELECT public.purge_anonymous_drafts()$$);