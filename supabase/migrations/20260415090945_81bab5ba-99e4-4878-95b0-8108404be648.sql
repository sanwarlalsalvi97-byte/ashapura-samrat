
DROP POLICY IF EXISTS "Users can update their own workers" ON workers;
CREATE POLICY "Users can update their own workers" ON workers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own attendance" ON attendance;
CREATE POLICY "Users can update their own attendance" ON attendance
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
