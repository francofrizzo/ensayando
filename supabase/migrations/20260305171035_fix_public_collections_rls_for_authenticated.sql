-- Extend public collection policies to also cover authenticated users
-- (the previous migration only granted access to anon)

CREATE POLICY "Allow authenticated select on public collections"
  ON public.collections
  FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Allow authenticated select on songs of public collections"
  ON public.songs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = songs.collection_id
        AND collections.is_public = true
    )
  );

CREATE POLICY "Allow authenticated select on audio_tracks of public collections"
  ON public.audio_tracks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.songs
      JOIN public.collections ON collections.id = songs.collection_id
      WHERE songs.id = audio_tracks.song_id
        AND collections.is_public = true
    )
  );
