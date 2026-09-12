CREATE POLICY "No direct client access to Drive credentials"
ON public.app_user_connections
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);