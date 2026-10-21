-- Instrumentals participate in the mix, never in verse audio assignments.
CREATE OR REPLACE FUNCTION public.parts_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cid bigint;
BEGIN
  IF TG_OP='UPDATE' AND NEW.id<>OLD.id THEN RAISE EXCEPTION 'ID_IMMUTABLE'; END IF;
  IF TG_TABLE_NAME='songs' THEN
    PERFORM 1 FROM public.collections WHERE id=NEW.collection_id FOR UPDATE;
    IF TG_OP='UPDATE' AND NEW.collection_id<>OLD.collection_id THEN RAISE EXCEPTION 'SONG_COLLECTION_IMMUTABLE'; END IF;
    NEW.lyrics := public.normalize_part_lyrics(NEW.lyrics,CASE WHEN TG_OP='UPDATE' THEN OLD.lyrics END,
      NEW.id,NEW.collection_id,pg_trigger_depth()>1);
    IF EXISTS (
      SELECT 1 FROM public.part_verses(NEW.lyrics) v
      JOIN public.audio_tracks t ON t.song_id=NEW.id AND t.kind='instrumental'
      WHERE v->'audio_track_ids' @> jsonb_build_array(t.id)
    ) THEN
      RAISE EXCEPTION 'INVALID_TRACK_IDS: las pistas instrumentales no pueden asignarse a la letra';
    END IF;
  ELSIF TG_TABLE_NAME='audio_tracks' THEN
    SELECT collection_id INTO cid FROM public.songs WHERE id=NEW.song_id;
    PERFORM 1 FROM public.collections WHERE id=cid FOR UPDATE;
    IF TG_OP='UPDATE' AND NEW.song_id<>OLD.song_id THEN RAISE EXCEPTION 'TRACK_SONG_IMMUTABLE'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(NEW.part_ids) x(id) WHERE NOT EXISTS
      (SELECT 1 FROM public.collection_parts p WHERE p.id=x.id AND p.collection_id=cid)) THEN
      RAISE EXCEPTION 'INVALID_PART_IDS';
    END IF;
  ELSE
    PERFORM 1 FROM public.collections WHERE id=NEW.collection_id FOR UPDATE;
    IF TG_OP='UPDATE' AND NEW.collection_id<>OLD.collection_id THEN RAISE EXCEPTION 'PART_COLLECTION_IMMUTABLE'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.collections WHERE id=NEW.collection_id AND track_colors ? NEW.color_key) THEN
      RAISE EXCEPTION 'INVALID_PART_COLOR';
    END IF;
    IF NEW.parent_id IS NOT NULL AND (NOT EXISTS (SELECT 1 FROM public.collection_parts
      WHERE id=NEW.parent_id AND collection_id=NEW.collection_id) OR EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT id,parent_id FROM public.collection_parts WHERE id=NEW.parent_id
        UNION SELECT p.id,p.parent_id FROM public.collection_parts p JOIN ancestors a ON p.id=a.parent_id
      ) SELECT 1 FROM ancestors WHERE id=NEW.id
    ) OR NEW.parent_id=NEW.id) THEN RAISE EXCEPTION 'INVALID_PART_PARENT'; END IF;
  END IF;
  RETURN NEW;
END $$;
