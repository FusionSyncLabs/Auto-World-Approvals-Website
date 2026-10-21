ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS vehicle_condition text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS purchase_timeline text;
COMMENT ON COLUMN public.leads.vehicle_condition IS 'Applicant vehicle preference: new, used, or not_sure; not a lending decision.';
COMMENT ON COLUMN public.leads.purchase_timeline IS 'Applicant purchase timing preference, including just_exploring.';
CREATE OR REPLACE FUNCTION public.record_intake_submission_consent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.consent_policy_version = 'intake-2026-10-v2' AND NEW.submitted_at IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.submitted_at IS NOT NULL THEN RETURN NEW; END IF;
    END IF;
    IF NEW.consent_contact IS DISTINCT FROM true OR NEW.consent_accuracy IS DISTINCT FROM true OR NEW.consent_not_guarantee IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Application acknowledgement is required';
    END IF;
    INSERT INTO public.consent_records(lead_id, policy_version, consent_contact, consent_credit_check, consent_accuracy, consent_not_guarantee, marketing_opt_in, ip_address, user_agent, captured_at)
    VALUES(NEW.id, NEW.consent_policy_version, NEW.consent_contact, NEW.consent_credit_check, NEW.consent_accuracy, NEW.consent_not_guarantee, NEW.consent_marketing, NEW.consent_ip, NEW.consent_user_agent, NEW.submitted_at);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_intake_submission_consent() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_intake_submission_consent() TO service_role;
CREATE TRIGGER record_intake_consent AFTER INSERT OR UPDATE OF submitted_at ON public.leads FOR EACH ROW EXECUTE FUNCTION public.record_intake_submission_consent();