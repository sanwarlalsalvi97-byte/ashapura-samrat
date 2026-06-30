DROP POLICY IF EXISTS "Authenticated can view worker expenses" ON public.worker_expenses;
DROP POLICY IF EXISTS "Authenticated can insert worker expenses" ON public.worker_expenses;
DROP POLICY IF EXISTS "Authenticated can update worker expenses" ON public.worker_expenses;
DROP POLICY IF EXISTS "Authenticated can delete worker expenses" ON public.worker_expenses;

DROP POLICY IF EXISTS "Users can manage their own payment history" ON public.payment_history;
CREATE POLICY "Users can select their own payment history" ON public.payment_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own payment history" ON public.payment_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own payment history" ON public.payment_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own payment history" ON public.payment_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own worker expenses" ON public.worker_expenses;
CREATE POLICY "Users can select their own worker expenses" ON public.worker_expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own worker expenses" ON public.worker_expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own worker expenses" ON public.worker_expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own worker expenses" ON public.worker_expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.claim_initial_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_initial_admin() TO authenticated, service_role;