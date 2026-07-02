
-- Add worker_code (4-digit) with per-user uniqueness and auto-assignment starting at 1001
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS worker_code TEXT;

-- Backfill existing rows: per-user sequential starting 1001, ordered by created_at
WITH ranked AS (
  SELECT id, user_id,
         (row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) + 1000) AS rn
  FROM public.workers
  WHERE worker_code IS NULL
)
UPDATE public.workers w
   SET worker_code = LPAD(r.rn::text, 4, '0')
  FROM ranked r
 WHERE r.id = w.id;

-- Per-user unique index (allows the same code across different tenants)
CREATE UNIQUE INDEX IF NOT EXISTS workers_user_worker_code_key
  ON public.workers(user_id, worker_code);

-- Trigger to auto-assign next 4-digit code per user, starting at 1001
CREATE OR REPLACE FUNCTION public.assign_worker_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.worker_code IS NULL OR NEW.worker_code = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(worker_code, '\D', '', 'g'), '')::int), 1000) + 1
      INTO next_num
      FROM public.workers
     WHERE user_id = NEW.user_id;
    IF next_num < 1001 THEN next_num := 1001; END IF;
    NEW.worker_code := LPAD(next_num::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_worker_code ON public.workers;
CREATE TRIGGER trg_assign_worker_code
BEFORE INSERT ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.assign_worker_code();
