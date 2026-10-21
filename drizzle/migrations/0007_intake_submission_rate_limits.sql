CREATE TABLE public.intake_rate_limits (bucket_key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL);
GRANT ALL ON public.intake_rate_limits TO service_role;
ALTER TABLE public.intake_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_intake_rate_limit(_bucket_key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.intake_rate_limits(bucket_key, attempts, expires_at) VALUES(_bucket_key,1,now()+interval '1 hour')
  ON CONFLICT(bucket_key) DO UPDATE SET attempts=CASE WHEN intake_rate_limits.expires_at<=now() THEN 1 ELSE intake_rate_limits.attempts+1 END, expires_at=CASE WHEN intake_rate_limits.expires_at<=now() THEN now()+interval '1 hour' ELSE intake_rate_limits.expires_at END
  RETURNING attempts INTO n;
  RETURN n<=10;
END $$;
REVOKE ALL ON FUNCTION public.claim_intake_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_intake_rate_limit(text) TO service_role;