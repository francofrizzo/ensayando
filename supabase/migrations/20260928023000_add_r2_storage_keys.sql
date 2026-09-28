-- Keep legacy provider URLs during the dual-read migration while storing new
-- uploads as provider-independent R2 object keys.
ALTER TABLE public.audio_tracks
  ADD COLUMN audio_file_key text;

ALTER TABLE public.collections
  ADD COLUMN artwork_file_key text;

CREATE UNIQUE INDEX audio_tracks_audio_file_key_idx
  ON public.audio_tracks (audio_file_key)
  WHERE audio_file_key IS NOT NULL;

CREATE UNIQUE INDEX collections_artwork_file_key_idx
  ON public.collections (artwork_file_key)
  WHERE artwork_file_key IS NOT NULL;

-- The migration script copies objects first, then applies every matching key in
-- one database transaction. Source URL checks prevent overwriting concurrent edits.
CREATE OR REPLACE FUNCTION public.apply_storage_key_migration(
  audio_updates jsonb,
  artwork_updates jsonb
)
RETURNS TABLE (audio_count bigint, artwork_count bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated_audio bigint;
  updated_artwork bigint;
BEGIN
  WITH updates AS (
    SELECT *
    FROM jsonb_to_recordset(audio_updates) AS value(id bigint, source_url text, object_key text)
  )
  UPDATE public.audio_tracks AS track
  SET audio_file_key = updates.object_key
  FROM updates
  WHERE track.id = updates.id
    AND track.audio_file_url = updates.source_url
    AND track.audio_file_key IS NULL;
  GET DIAGNOSTICS updated_audio = ROW_COUNT;

  WITH updates AS (
    SELECT *
    FROM jsonb_to_recordset(artwork_updates) AS value(id bigint, source_url text, object_key text)
  )
  UPDATE public.collections AS collection
  SET artwork_file_key = updates.object_key
  FROM updates
  WHERE collection.id = updates.id
    AND collection.artwork_file_url = updates.source_url
    AND collection.artwork_file_key IS NULL;
  GET DIAGNOSTICS updated_artwork = ROW_COUNT;

  RETURN QUERY SELECT updated_audio, updated_artwork;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_storage_key_migration(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_storage_key_migration(jsonb, jsonb) TO service_role;
