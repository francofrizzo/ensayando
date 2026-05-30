-- Replace the binary is_public flag with a tri-state visibility:
--   'private'  — only members (via user_collections) can read it
--   'unlisted' — anyone with the link can read it, but it's hidden from sidebar listings
--   'public'   — anyone can read it and it appears in every sidebar
--
-- RLS treats 'public' and 'unlisted' identically (both are link-readable); the only
-- difference is client-side: the listing query fetches 'public' collections, while
-- 'unlisted' ones are resolved on demand by slug. Membership-based read access to
-- 'private' collections is unchanged (handled by a separate, pre-existing policy).

-- 1. Add the new column and backfill from is_public.
ALTER TABLE public.collections
  ADD COLUMN visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'unlisted', 'public'));

UPDATE public.collections SET visibility = 'public' WHERE is_public = true;

-- 2. Drop the policies that reference is_public (must happen before dropping the column).
DROP POLICY IF EXISTS "Allow public select on public collections" ON public.collections;
DROP POLICY IF EXISTS "Allow authenticated select on public collections" ON public.collections;
DROP POLICY IF EXISTS "Allow public select on songs of public collections" ON public.songs;
DROP POLICY IF EXISTS "Allow authenticated select on songs of public collections" ON public.songs;
DROP POLICY IF EXISTS "Allow public select on audio_tracks of public collections" ON public.audio_tracks;
DROP POLICY IF EXISTS "Allow authenticated select on audio_tracks of public collections" ON public.audio_tracks;

-- 3. Drop the old column.
ALTER TABLE public.collections DROP COLUMN is_public;

-- 4. Recreate the read policies against visibility. "Shared" = public OR unlisted: both are
--    readable by anyone with the link, for collections and their songs/audio_tracks.

-- Collections
CREATE POLICY "Allow anon select on shared collections"
  ON public.collections
  FOR SELECT
  TO anon
  USING (visibility IN ('public', 'unlisted'));

CREATE POLICY "Allow authenticated select on shared collections"
  ON public.collections
  FOR SELECT
  TO authenticated
  USING (visibility IN ('public', 'unlisted'));

-- Songs
CREATE POLICY "Allow anon select on songs of shared collections"
  ON public.songs
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = songs.collection_id
        AND collections.visibility IN ('public', 'unlisted')
    )
  );

CREATE POLICY "Allow authenticated select on songs of shared collections"
  ON public.songs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = songs.collection_id
        AND collections.visibility IN ('public', 'unlisted')
    )
  );

-- Audio tracks
CREATE POLICY "Allow anon select on audio_tracks of shared collections"
  ON public.audio_tracks
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.songs
      JOIN public.collections ON collections.id = songs.collection_id
      WHERE songs.id = audio_tracks.song_id
        AND collections.visibility IN ('public', 'unlisted')
    )
  );

CREATE POLICY "Allow authenticated select on audio_tracks of shared collections"
  ON public.audio_tracks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.songs
      JOIN public.collections ON collections.id = songs.collection_id
      WHERE songs.id = audio_tracks.song_id
        AND collections.visibility IN ('public', 'unlisted')
    )
  );
