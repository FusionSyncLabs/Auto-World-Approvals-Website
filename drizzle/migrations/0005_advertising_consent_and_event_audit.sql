CREATE TABLE public.advertising_consent_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 visitor_token uuid NOT NULL,
 advertising boolean NOT NULL,
 analytics boolean NOT NULL DEFAULT false,
 region text NOT NULL DEFAULT 'UNKNOWN',
 notice_version text NOT NULL,
 notice_text text NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.advertising_consent_records TO service_role;
ALTER TABLE public.advertising_consent_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX advertising_consent_visitor_latest ON public.advertising_consent_records(visitor_token, captured_at DESC);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS advertising_consent_id uuid REFERENCES public.advertising_consent_records(id);
CREATE TABLE public.ad_conversion_log (
 event_id text PRIMARY KEY,
 lead_id uuid REFERENCES public.leads(id),
 event_name text NOT NULL CHECK (event_name IN ('Lead','PageView')),
 occurred_at timestamptz NOT NULL,
 consent_record_id uuid REFERENCES public.advertising_consent_records(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','blocked')),
 http_status integer,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ad_conversion_log TO service_role;
ALTER TABLE public.ad_conversion_log ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.advertising_consent_records IS 'Append-only advertising choice evidence, separate from contact consent and promotional email opt-in. Service-only access.';
COMMENT ON TABLE public.ad_conversion_log IS 'One server event attempt per stable event ID; stores no matching identifiers or payload. Receipt is not attribution.';