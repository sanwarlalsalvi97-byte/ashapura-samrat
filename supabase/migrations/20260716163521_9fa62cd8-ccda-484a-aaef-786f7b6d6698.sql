ALTER TABLE public.cashbook
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payment_history(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cashbook_payment_id_key ON public.cashbook(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashbook_worker ON public.cashbook(worker_id);