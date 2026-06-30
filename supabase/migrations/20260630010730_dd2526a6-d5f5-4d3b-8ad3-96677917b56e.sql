CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  worker_id uuid REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text NOT NULL DEFAULT 'cash',
  note text,
  site_name text,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_history TO authenticated;
GRANT ALL ON public.payment_history TO service_role;

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own payment history"
  ON public.payment_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

ALTER TABLE public.worker_expenses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

DROP POLICY IF EXISTS "Enable read access for all users" ON public.worker_expenses;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.worker_expenses;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.worker_expenses;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.worker_expenses;
DROP POLICY IF EXISTS "Allow all" ON public.worker_expenses;
DROP POLICY IF EXISTS "worker_expenses_all" ON public.worker_expenses;

CREATE POLICY "Users can manage their own worker expenses"
  ON public.worker_expenses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_history;