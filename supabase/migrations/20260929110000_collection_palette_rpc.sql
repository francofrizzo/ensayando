-- Saving the Colores section of the collection settings in one transaction
-- (design/pantallas/coleccion.html).
--
-- update_collection_palette sets the collection hue and intensity and replaces
-- track_colors. p_key_map maps keys that disappear (renamed or removed) to the key
-- that replaces them; every track (audio_tracks.color_key) and every verse
-- (songs.lyrics …color_keys) is rewritten in the same operation, so nothing is left
-- pointing at a key that no longer exists.

-- Rewrites color_keys anywhere in a lyrics document (stanzas, verses, columns).
CREATE FUNCTION public.remap_lyric_color_keys(p_value jsonb, p_key_map jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_value IS NULL OR p_key_map IS NULL OR p_key_map = '{}'::jsonb THEN
    RETURN p_value;
  END IF;

  IF jsonb_typeof(p_value) = 'array' THEN
    SELECT coalesce(jsonb_agg(public.remap_lyric_color_keys(item, p_key_map) ORDER BY position), '[]'::jsonb)
    INTO result
    FROM jsonb_array_elements(p_value) WITH ORDINALITY AS elements(item, position);
    RETURN result;
  END IF;

  IF jsonb_typeof(p_value) = 'object' AND jsonb_typeof(p_value -> 'color_keys') = 'array' THEN
    -- Map each key and keep the first occurrence of each result, in order.
    SELECT coalesce(jsonb_agg(to_jsonb(mapped) ORDER BY first_position), '[]'::jsonb)
    INTO result
    FROM (
      SELECT coalesce(p_key_map ->> key_text, key_text) AS mapped, min(position) AS first_position
      FROM jsonb_array_elements_text(p_value -> 'color_keys') WITH ORDINALITY AS keys(key_text, position)
      GROUP BY 1
    ) AS remapped;
    RETURN jsonb_set(p_value, '{color_keys}', result);
  END IF;

  RETURN p_value;
END;
$$;

CREATE FUNCTION public.update_collection_palette(
  p_collection_id bigint,
  p_hue integer,
  p_intensity text,
  p_track_colors jsonb,
  p_key_map jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  key_map jsonb := coalesce(p_key_map, '{}'::jsonb);
BEGIN
  IF NOT public.is_collection_admin(p_collection_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_track_colors IS NULL OR jsonb_typeof(p_track_colors) <> 'object'
     OR jsonb_typeof(key_map) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_PALETTE' USING ERRCODE = '22023';
  END IF;

  -- Every replacement must be a key of the new palette.
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(key_map) AS m(old_key, new_key)
    WHERE NOT (p_track_colors ? m.new_key)
  ) THEN
    RAISE EXCEPTION 'INVALID_PALETTE' USING ERRCODE = '22023';
  END IF;

  UPDATE public.collections
  SET hue = p_hue, intensity = p_intensity, track_colors = p_track_colors
  WHERE id = p_collection_id;

  IF key_map <> '{}'::jsonb THEN
    UPDATE public.audio_tracks AS track
    SET color_key = key_map ->> track.color_key
    FROM public.songs AS song
    WHERE song.id = track.song_id
      AND song.collection_id = p_collection_id
      AND key_map ? track.color_key;

    UPDATE public.songs
    SET lyrics = public.remap_lyric_color_keys(lyrics, key_map)
    WHERE collection_id = p_collection_id AND lyrics IS NOT NULL;
  END IF;

  -- No track may be left on a key that no longer exists.
  IF EXISTS (
    SELECT 1
    FROM public.audio_tracks AS track
    JOIN public.songs AS song ON song.id = track.song_id
    WHERE song.collection_id = p_collection_id
      AND NOT (p_track_colors ? track.color_key)
  ) THEN
    RAISE EXCEPTION 'KEY_IN_USE' USING ERRCODE = '23503';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remap_lyric_color_keys(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_collection_palette(bigint, integer, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remap_lyric_color_keys(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_collection_palette(bigint, integer, text, jsonb, jsonb) TO authenticated;
