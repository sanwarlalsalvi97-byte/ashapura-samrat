ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS in_time time,
  ADD COLUMN IF NOT EXISTS out_time time,
  ADD COLUMN IF NOT EXISTS total_hours numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours numeric(5,2) DEFAULT 0;