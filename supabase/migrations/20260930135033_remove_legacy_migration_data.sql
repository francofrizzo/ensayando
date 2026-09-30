-- The R2 and hue migrations have been verified in production. Remove their
-- one-shot database artifacts and the legacy artwork URL fallback.
-- Applied to production as migration 20260930135033.
DROP FUNCTION IF EXISTS public.apply_storage_key_migration(jsonb, jsonb);
DROP TABLE IF EXISTS public.collections_color_backup;

ALTER TABLE public.collections
  DROP COLUMN artwork_file_url;

-- Every populated legacy URL has a verified R2 key. External URLs remain
-- supported when audio_file_key is null.
UPDATE public.audio_tracks
SET audio_file_url = ''
WHERE audio_file_key IS NOT NULL
  AND audio_file_url <> '';

ALTER TABLE public.audio_tracks
  ADD CONSTRAINT audio_tracks_exactly_one_audio_source
  CHECK (
    (audio_file_key IS NOT NULL AND audio_file_url = '')
    OR (audio_file_key IS NULL AND audio_file_url <> '')
  );
