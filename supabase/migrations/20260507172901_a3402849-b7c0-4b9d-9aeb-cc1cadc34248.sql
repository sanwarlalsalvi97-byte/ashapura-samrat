ALTER TABLE public.contractors 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'चालू',
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;