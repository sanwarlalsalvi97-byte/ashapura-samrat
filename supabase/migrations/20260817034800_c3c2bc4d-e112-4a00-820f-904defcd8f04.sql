ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS linked_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS workers_linked_user_id_key ON public.workers (linked_user_id) WHERE linked_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_linked_worker_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.workers WHERE linked_user_id = _user_id LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_linked_worker_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linked_worker_id(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.link_worker_account(_worker_code text, _phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  wid uuid;
  digits text := regexp_replace(COALESCE(_phone, ''), '\D', '', 'g');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO wid FROM public.workers WHERE linked_user_id = uid LIMIT 1;
  IF wid IS NOT NULL THEN
    RETURN wid;
  END IF;

  SELECT id INTO wid
  FROM public.workers
  WHERE is_active = true
    AND linked_user_id IS NULL
    AND lpad(regexp_replace(COALESCE(worker_code, ''), '\D', '', 'g'), 4, '0') = lpad(regexp_replace(COALESCE(_worker_code, ''), '\D', '', 'g'), 4, '0')
    AND right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) = right(digits, 10)
    AND length(digits) >= 10
  LIMIT 1;

  IF wid IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.workers SET linked_user_id = uid WHERE id = wid AND linked_user_id IS NULL;
  RETURN wid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_worker_account(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_worker_account(text, text) TO authenticated;

CREATE POLICY "Linked worker can view own worker row"
ON public.workers FOR SELECT TO authenticated
USING (linked_user_id = auth.uid());

CREATE POLICY "Linked worker can view own attendance"
ON public.attendance FOR SELECT TO authenticated
USING (worker_id = public.get_linked_worker_id(auth.uid()));

CREATE POLICY "Linked worker can view own attendance logs"
ON public.attendance_logs FOR SELECT TO authenticated
USING (worker_id = public.get_linked_worker_id(auth.uid()));

CREATE POLICY "Linked worker can view own payment history"
ON public.payment_history FOR SELECT TO authenticated
USING (worker_id = public.get_linked_worker_id(auth.uid()));

CREATE POLICY "Linked worker can view own expenses"
ON public.worker_expenses FOR SELECT TO authenticated
USING (worker_id = public.get_linked_worker_id(auth.uid()));