CREATE POLICY "Service role manages lead distribution assignments"
ON public.lead_distribution_assignments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);