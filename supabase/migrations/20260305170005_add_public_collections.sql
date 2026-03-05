-- Add is_public column to collections
ALTER TABLE public.collections
  ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Allow anonymous/public SELECT on public collections
CREATE POLICY "Allow public select on public collections"
  ON public.collections
  FOR SELECT
  TO anon
  USING (is_public = true);

-- Allow anonymous/public SELECT on songs belonging to public collections
CREATE POLICY "Allow public select on songs of public collections"
  ON public.songs
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = songs.collection_id
        AND collections.is_public = true
    )
  );

-- Allow anonymous/public SELECT on audio_tracks belonging to songs of public collections
CREATE POLICY "Allow public select on audio_tracks of public collections"
  ON public.audio_tracks
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.songs
      JOIN public.collections ON collections.id = songs.collection_id
      WHERE songs.id = audio_tracks.song_id
        AND collections.is_public = true
    )
  );
