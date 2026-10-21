-- Extend lead_status to include draft/submitted lifecycle values
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'new';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'submitted' AFTER 'new';

-- Draft tracking columns on leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS resume_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS current_step text,
  ADD COLUMN IF NOT EXISTS completion_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminders_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_contact_captured_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_resume_token_idx ON public.leads (resume_token);
CREATE INDEX IF NOT EXISTS leads_status_activity_idx ON public.leads (status, last_activity_at);