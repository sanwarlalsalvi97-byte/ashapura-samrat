ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS accuracy_meters numeric,
  ADD COLUMN IF NOT EXISTS is_suspicious boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspicious_reason text,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_logs_review_status_check'
  ) THEN
    ALTER TABLE public.attendance_logs
      ADD CONSTRAINT attendance_logs_review_status_check
      CHECK (review_status IN ('pending','approved','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS attendance_logs_review_idx
  ON public.attendance_logs (review_status, log_date DESC);