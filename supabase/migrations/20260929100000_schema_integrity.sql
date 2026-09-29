-- Schema integrity for in-app administration (redesign, phase 3).
--
-- The remote schema dump never declared cascades for songs/audio_tracks, nor
-- uniqueness for slugs or memberships. Deleting a song or a collection from the
-- app needs the database to clean up its children, and the new routes
-- (/:collection/nueva, /:collection/ajustes) need a few song slugs reserved.
--
-- Production may differ from these migrations: diff it before deploying
-- (see docs/permissions.md).

-- 1. Cascades: deleting a collection removes its songs, a song its tracks.
ALTER TABLE public.audio_tracks
  DROP CONSTRAINT IF EXISTS audio_tracks_song_id_fkey,
  ADD CONSTRAINT audio_tracks_song_id_fkey
    FOREIGN KEY (song_id) REFERENCES public.songs (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.songs
  DROP CONSTRAINT IF EXISTS songs_collection_id_fkey,
  ADD CONSTRAINT songs_collection_id_fkey
    FOREIGN KEY (collection_id) REFERENCES public.collections (id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. Uniqueness. Collection slugs are global (they are the first URL segment);
--    song slugs are unique within their collection; a person has one role per
--    collection.
CREATE UNIQUE INDEX IF NOT EXISTS collections_slug_key ON public.collections (slug);
CREATE UNIQUE INDEX IF NOT EXISTS songs_collection_id_slug_key ON public.songs (collection_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS user_collections_user_id_collection_id_key
  ON public.user_collections (user_id, collection_id);

ALTER TABLE public.user_collections
  DROP CONSTRAINT IF EXISTS user_collections_role_check,
  ADD CONSTRAINT user_collections_role_check CHECK (role IN ('admin', 'editor', 'viewer'));

-- 3. Reserved song slugs: they collide with /:collection/nueva, /:collection/ajustes
--    and the edit mode. Existing songs that use them get a suffix.
UPDATE public.songs
SET slug = slug || '-cancion'
WHERE slug IN ('nueva', 'ajustes', 'editar');

ALTER TABLE public.songs
  ADD CONSTRAINT songs_slug_not_reserved CHECK (slug NOT IN ('nueva', 'ajustes', 'editar'));

-- 4. Song duration in seconds, written when audio is uploaded (the library shows it
--    without decoding audio).
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS duration numeric;

UPDATE public.songs AS song
SET duration = sub.duration
FROM (
  SELECT song_id, max((peaks ->> 'duration')::numeric) AS duration
  FROM public.audio_tracks
  WHERE peaks ? 'duration'
  GROUP BY song_id
) AS sub
WHERE sub.song_id = song.id AND song.duration IS NULL;
