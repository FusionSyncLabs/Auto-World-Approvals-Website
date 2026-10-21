ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_canadian_resident text,
  ADD COLUMN IF NOT EXISTS pay_frequency text,
  ADD COLUMN IF NOT EXISTS additional_income text,
  ADD COLUMN IF NOT EXISTS additional_income_source text,
  ADD COLUMN IF NOT EXISTS additional_income_amount text,
  ADD COLUMN IF NOT EXISTS employment_length text,
  ADD COLUMN IF NOT EXISTS address_length text;