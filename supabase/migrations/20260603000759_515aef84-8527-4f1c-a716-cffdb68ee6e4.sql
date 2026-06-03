ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS work_type text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'नकद',
  ADD COLUMN IF NOT EXISTS assigned_workers uuid[] DEFAULT '{}'::uuid[];