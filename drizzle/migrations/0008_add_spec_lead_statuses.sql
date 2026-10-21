ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'contact_attempted';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'not_proceeding';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'closed';