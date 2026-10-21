DELETE FROM public.lead_sends a
USING public.lead_sends b
WHERE a.recipient_name = 'Auto delivery'
  AND b.recipient_name = 'Auto delivery'
  AND a.lead_id = b.lead_id
  AND lower(a.recipient_email) = lower(b.recipient_email)
  AND (a.sent_at, a.id) > (b.sent_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS lead_sends_auto_unique
  ON public.lead_sends (lead_id, lower(recipient_email))
  WHERE recipient_name = 'Auto delivery';