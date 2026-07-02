
REVOKE ALL ON FUNCTION public.assign_worker_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_worker_code() TO service_role;
