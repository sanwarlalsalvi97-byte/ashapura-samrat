ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS gps_status text,
  ADD COLUMN IF NOT EXISTS gps_lat numeric,
  ADD COLUMN IF NOT EXISTS gps_lng numeric;