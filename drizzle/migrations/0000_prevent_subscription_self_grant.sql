CREATE OR REPLACE FUNCTION public.enforce_safe_subscription_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signup_at timestamptz;
BEGIN
  -- Requests carrying a user JWT are untrusted client inserts. Force every
  -- such row to the server-defined trial state, regardless of supplied values.
  IF auth.uid() IS NOT NULL THEN
    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'subscription_user_mismatch';
    END IF;

    SELECT created_at INTO signup_at
    FROM auth.users
    WHERE id = auth.uid();

    IF signup_at IS NULL THEN
      RAISE EXCEPTION 'subscription_user_not_found';
    END IF;

    NEW.user_id := auth.uid();
    NEW.plan := 'trial';
    NEW.premium_until := NULL;
    NEW.trial_started_at := signup_at;
    NEW.trial_ends_at := signup_at + interval '3 months';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_safe_subscription_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_safe_subscription_insert_trigger ON public.subscriptions;
CREATE TRIGGER enforce_safe_subscription_insert_trigger
  BEFORE INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_safe_subscription_insert();