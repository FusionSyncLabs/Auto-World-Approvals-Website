ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS notes_summary text,
  ADD COLUMN IF NOT EXISTS notes_summary_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_contacted_at timestamptz;