ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS photo_url text;

CREATE POLICY "Users can upload own worker photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'worker-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own worker photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'worker-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own worker photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'worker-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'worker-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own worker photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'worker-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);