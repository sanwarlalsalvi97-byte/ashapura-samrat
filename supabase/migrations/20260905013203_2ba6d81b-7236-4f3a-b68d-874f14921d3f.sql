REVOKE UPDATE ON public.subscriptions FROM authenticated;

CREATE OR REPLACE FUNCTION public.is_premium_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND premium_until IS NOT NULL
      AND premium_until > now()
  );
$$;

REVOKE ALL ON FUNCTION public.is_premium_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_worker_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub RECORD;
  worker_count int;
BEGIN
  IF public.is_premium_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT trial_ends_at INTO sub
  FROM public.subscriptions
  WHERE user_id = NEW.user_id;

  IF NOT FOUND OR sub.trial_ends_at > now() THEN
    SELECT count(*) INTO worker_count
    FROM public.workers
    WHERE user_id = NEW.user_id;
    IF worker_count >= 7 THEN
      RAISE EXCEPTION 'free_worker_limit_reached'
        USING HINT = 'Free trial allows up to 7 workers. Upgrade to premium for unlimited workers.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'trial_expired'
    USING HINT = 'Free trial has ended. Please subscribe to add workers.';
END;
$$;

DROP TRIGGER IF EXISTS enforce_worker_limit_trigger ON public.workers;
CREATE TRIGGER enforce_worker_limit_trigger
  BEFORE INSERT ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_limit();