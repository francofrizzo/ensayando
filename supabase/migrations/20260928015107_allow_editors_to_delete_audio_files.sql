-- Storage deletion requires both SELECT and DELETE access to the object.
CREATE POLICY "collection editors can select audio files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND EXISTS (
      SELECT 1
      FROM public.collections c
      JOIN public.user_collections uc ON uc.collection_id = c.id
      WHERE c.slug = split_part(storage.objects.name, '/', 1)
        AND uc.user_id = (SELECT auth.uid())
        AND uc.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "collection editors can delete audio files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND EXISTS (
      SELECT 1
      FROM public.collections c
      JOIN public.user_collections uc ON uc.collection_id = c.id
      WHERE c.slug = split_part(storage.objects.name, '/', 1)
        AND uc.user_id = (SELECT auth.uid())
        AND uc.role IN ('admin', 'editor')
    )
  );
