ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS upi_id text;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS upi_id text;