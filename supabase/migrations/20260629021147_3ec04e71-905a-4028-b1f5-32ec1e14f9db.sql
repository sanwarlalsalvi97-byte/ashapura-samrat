CREATE TABLE public.worker_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'other',
  amount NUMERIC NOT NULL DEFAULT 0,
  site_name TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_expenses TO authenticated;
GRANT ALL ON public.worker_expenses TO service_role;

ALTER TABLE public.worker_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view worker expenses"
  ON public.worker_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert worker expenses"
  ON public.worker_expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update worker expenses"
  ON public.worker_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete worker expenses"
  ON public.worker_expenses FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_worker_expenses_worker_date ON public.worker_expenses(worker_id, date);
CREATE INDEX idx_worker_expenses_date ON public.worker_expenses(date);

CREATE TRIGGER trg_worker_expenses_updated
  BEFORE UPDATE ON public.worker_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_expenses;
ALTER TABLE public.worker_expenses REPLICA IDENTITY FULL;