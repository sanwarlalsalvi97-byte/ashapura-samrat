
-- 1. Replace permissive INSERT policy on user_roles
DROP POLICY IF EXISTS "Users can insert own initial admin" ON public.user_roles;

CREATE POLICY "Users can self-assign staff role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'staff'::public.app_role);

-- 2. Remove broad admin SELECT policy that exposes all users' UUIDs
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- 3. Secure bootstrap function: only first user (when no admins exist) can become admin
CREATE OR REPLACE FUNCTION public.claim_initial_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, 'admin'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_initial_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_initial_admin() TO authenticated;

-- 4. Lock down has_role: it's used inside RLS (runs as definer) so revoking from clients is safe
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
