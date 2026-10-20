-- Stage 1: roles are metadata; playback still consumes materialized verse fields.
LOCK TABLE public.collections, public.songs, public.audio_tracks IN SHARE ROW EXCLUSIVE MODE;
-- Private recovery snapshot. Deliberately retained after production validation.
CREATE SCHEMA IF NOT EXISTS migration_backups;
REVOKE ALL ON SCHEMA migration_backups FROM PUBLIC, anon, authenticated;
CREATE TABLE migration_backups.parts_stage1_collections AS SELECT id,hue,intensity,track_colors FROM public.collections;
CREATE TABLE migration_backups.parts_stage1_tracks AS SELECT * FROM public.audio_tracks;
CREATE TABLE migration_backups.parts_stage1_lyrics AS SELECT id,collection_id,lyrics FROM public.songs;
REVOKE ALL ON ALL TABLES IN SCHEMA migration_backups FROM PUBLIC, anon, authenticated;

CREATE TABLE public.collection_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id bigint NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  color_key text NOT NULL,
  parent_id uuid REFERENCES public.collection_parts(id) DEFERRABLE INITIALLY DEFERRED,
  "order" integer NOT NULL DEFAULT 0,
  migration_origin_key text,
  UNIQUE(collection_id, migration_origin_key)
);
ALTER TABLE public.collection_parts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.collection_parts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.collection_parts TO authenticated;
GRANT ALL ON public.collection_parts TO service_role;
CREATE POLICY parts_read ON public.collection_parts FOR SELECT USING
  (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id));
CREATE POLICY parts_admin ON public.collection_parts FOR ALL TO authenticated
  USING (public.is_collection_admin(collection_id))
  WITH CHECK (public.is_collection_admin(collection_id));

ALTER TABLE public.audio_tracks
  ADD COLUMN kind text NOT NULL DEFAULT 'unclassified' CHECK (kind IN ('voice','instrumental','unclassified')),
  ADD COLUMN part_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN parts_reviewed boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT instrumental_has_no_parts CHECK (kind <> 'instrumental' OR cardinality(part_ids) = 0);

-- Walk only arrays: stanza and column nesting, never unrelated object metadata.
CREATE FUNCTION public.part_verses(v jsonb) RETURNS SETOF jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(v) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP
      RETURN QUERY SELECT * FROM public.part_verses(item);
    END LOOP;
  ELSIF jsonb_typeof(v) = 'object' THEN RETURN NEXT v;
  END IF;
END $$;

INSERT INTO public.collection_parts(id,collection_id,name,color_key,"order",migration_origin_key)
SELECT md5('ensayando:parts:v1:' || c.id || ':' || k.key)::uuid, c.id,
  coalesce(nullif(btrim(c.track_colors -> k.key ->> 'name'), ''),
    (SELECT min(t.title) FROM public.audio_tracks t JOIN public.songs s ON s.id=t.song_id
     WHERE s.collection_id=c.id AND t.color_key=k.key
     HAVING count(DISTINCT t.title)=1), k.key), k.key,
  (row_number() OVER (PARTITION BY c.id ORDER BY k.key)-1)::integer, k.key
FROM public.collections c CROSS JOIN LATERAL jsonb_object_keys(c.track_colors) k(key)
WHERE EXISTS (SELECT 1 FROM public.songs s CROSS JOIN LATERAL public.part_verses(s.lyrics) v
  WHERE s.collection_id=c.id AND v -> 'color_keys' ? k.key)
ON CONFLICT (collection_id,migration_origin_key) DO NOTHING;

CREATE FUNCTION public.backfill_lyric_parts(v jsonb, cid bigint) RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE result jsonb; ids jsonb;
BEGIN
  IF jsonb_typeof(v)='array' THEN
    SELECT coalesce(jsonb_agg(public.backfill_lyric_parts(value,cid) ORDER BY ord),'[]') INTO result
    FROM jsonb_array_elements(v) WITH ORDINALITY x(value,ord);
    RETURN result;
  END IF;
  IF jsonb_typeof(v)='object' AND jsonb_typeof(v->'color_keys')='array' THEN
    SELECT jsonb_agg(p.id ORDER BY x.ord) INTO ids
    FROM jsonb_array_elements_text(v->'color_keys') WITH ORDINALITY x(key,ord)
    JOIN public.collection_parts p ON p.collection_id=cid AND p.migration_origin_key=x.key;
    IF ids IS NOT NULL THEN
      RETURN v || jsonb_build_object('part_ids',ids,'audio_override',true,'color_override',true);
    END IF;
  END IF;
  RETURN v;
END $$;
UPDATE public.songs SET lyrics=public.backfill_lyric_parts(lyrics,collection_id) WHERE lyrics IS NOT NULL;
UPDATE public.audio_tracks t SET part_ids=coalesce((
  SELECT array_agg(DISTINCT p.id ORDER BY p.id)
  FROM public.songs s CROSS JOIN LATERAL public.part_verses(s.lyrics) v
  CROSS JOIN LATERAL jsonb_array_elements_text(v->'part_ids') x(id)
  JOIN public.collection_parts p ON p.id=x.id::uuid
  WHERE s.id=t.song_id AND v->'audio_track_ids'=jsonb_build_array(t.id)
), '{}');
DROP FUNCTION public.backfill_lyric_parts(jsonb,bigint);

-- Compare every legacy verse, including nested columns, not just row counts.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM migration_backups.parts_stage1_lyrics b JOIN public.songs s USING (id)
    WHERE (SELECT jsonb_agg(v ORDER BY ord) FROM public.part_verses(b.lyrics) WITH ORDINALITY x(v,ord))
      IS DISTINCT FROM (SELECT jsonb_agg(v - 'part_ids' - 'audio_override' - 'color_override' ORDER BY ord)
        FROM public.part_verses(s.lyrics) WITH ORDINALITY x(v,ord))
  ) THEN RAISE EXCEPTION 'Legacy lyrics changed during parts migration'; END IF;
  IF EXISTS (
    SELECT 1 FROM migration_backups.parts_stage1_tracks b JOIN public.audio_tracks t USING (id)
    WHERE to_jsonb(b) IS DISTINCT FROM to_jsonb(t) - 'kind' - 'part_ids' - 'parts_reviewed'
  ) THEN RAISE EXCEPTION 'Legacy tracks changed during parts migration'; END IF;
END $$;

CREATE FUNCTION public.normalize_part_lyrics(v jsonb, old_v jsonb, sid bigint, cid bigint, resync boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE result jsonb; ids uuid[]; colors jsonb; tracks jsonb; field text; i integer;
BEGIN
  IF jsonb_typeof(v)='array' THEN
    result := '[]';
    FOR i IN 0..jsonb_array_length(v)-1 LOOP
      result := result || jsonb_build_array(public.normalize_part_lyrics(v->i,old_v->i,sid,cid,resync));
    END LOOP;
    RETURN result;
  END IF;
  IF jsonb_typeof(v) <> 'object' THEN RETURN v; END IF;
  IF v ? 'audio_track_ids' THEN
    IF jsonb_typeof(v->'audio_track_ids') <> 'array' THEN RAISE EXCEPTION 'INVALID_TRACK_IDS'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(v->'audio_track_ids') x(id)
      WHERE NOT EXISTS (SELECT 1 FROM public.audio_tracks t WHERE t.song_id=sid AND t.id::text=x.id)) THEN
      RAISE EXCEPTION 'INVALID_TRACK_IDS: las pistas deben pertenecer a esta canción';
    END IF;
  END IF;
  IF NOT (v ? 'part_ids') THEN RETURN v; END IF;
  IF jsonb_typeof(v->'part_ids') <> 'array' THEN RAISE EXCEPTION 'INVALID_PART_IDS'; END IF;
  SELECT coalesce(array_agg(id::uuid ORDER BY ord),'{}') INTO ids
    FROM jsonb_array_elements_text(v->'part_ids') WITH ORDINALITY x(id,ord);
  IF EXISTS (SELECT 1 FROM unnest(ids) x(id) WHERE NOT EXISTS
    (SELECT 1 FROM public.collection_parts p WHERE p.id=x.id AND p.collection_id=cid)) THEN
    RAISE EXCEPTION 'INVALID_PART_IDS: las partes deben pertenecer a esta colección';
  END IF;
  FOREACH field IN ARRAY ARRAY['audio_override','color_override'] LOOP
    IF v ? field AND jsonb_typeof(v->field)<>'boolean' THEN RAISE EXCEPTION 'INVALID_OVERRIDE'; END IF;
  END LOOP;
  -- An unchanged part selection plus changed materialized field is an old-client
  -- exception, not permission to discard that edit. Clearing flags alone opts in.
  IF NOT resync AND old_v->'part_ids'=v->'part_ids' THEN
    IF v->'audio_track_ids' IS DISTINCT FROM old_v->'audio_track_ids'
      AND NOT (coalesce(old_v->>'audio_override','false')='true' AND coalesce(v->>'audio_override','true')='false') THEN
      v := v || '{"audio_override":true}';
    END IF;
    IF v->'color_keys' IS DISTINCT FROM old_v->'color_keys'
      AND NOT (coalesce(old_v->>'color_override','false')='true' AND coalesce(v->>'color_override','true')='false') THEN
      v := v || '{"color_override":true}';
    END IF;
  END IF;
  IF NOT coalesce((v->>'color_override')::boolean,false) THEN
    SELECT coalesce(jsonb_agg(color_key ORDER BY ord),'[]') INTO colors
      FROM unnest(ids) WITH ORDINALITY x(id,ord) JOIN public.collection_parts p ON p.id=x.id;
    v := v || jsonb_build_object('color_keys',colors,'color_override',false);
  END IF;
  IF NOT coalesce((v->>'audio_override')::boolean,false) THEN
    SELECT jsonb_agg(t.id ORDER BY t.id) INTO tracks FROM public.audio_tracks t
      WHERE t.song_id=sid AND t.part_ids && ids AND t.kind <> 'instrumental';
    v := (v - 'audio_track_ids') || '{"audio_override":false}';
    IF tracks IS NOT NULL THEN v := v || jsonb_build_object('audio_track_ids',tracks); END IF;
  END IF;
  RETURN v;
END $$;

CREATE FUNCTION public.parts_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cid bigint;
BEGIN
  IF TG_OP='UPDATE' AND NEW.id<>OLD.id THEN RAISE EXCEPTION 'ID_IMMUTABLE'; END IF;
  IF TG_TABLE_NAME='songs' THEN
    PERFORM 1 FROM public.collections WHERE id=NEW.collection_id FOR UPDATE;
    IF TG_OP='UPDATE' AND NEW.collection_id<>OLD.collection_id THEN RAISE EXCEPTION 'SONG_COLLECTION_IMMUTABLE'; END IF;
    NEW.lyrics := public.normalize_part_lyrics(NEW.lyrics,CASE WHEN TG_OP='UPDATE' THEN OLD.lyrics END,
      NEW.id,NEW.collection_id,pg_trigger_depth()>1);
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
CREATE TRIGGER parts_validate BEFORE INSERT OR UPDATE ON public.collection_parts FOR EACH ROW EXECUTE FUNCTION public.parts_guard();
CREATE TRIGGER tracks_parts_validate BEFORE INSERT OR UPDATE ON public.audio_tracks FOR EACH ROW EXECUTE FUNCTION public.parts_guard();
CREATE TRIGGER songs_parts_validate BEFORE INSERT OR UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.parts_guard();

CREATE FUNCTION public.resync_part_lyrics() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME='collection_parts' THEN
    IF NEW.color_key IS NOT DISTINCT FROM OLD.color_key THEN RETURN NEW; END IF;
    UPDATE public.songs SET lyrics=public.normalize_part_lyrics(lyrics,lyrics,id,collection_id,true)
      WHERE collection_id=NEW.collection_id;
  ELSE
    UPDATE public.songs SET lyrics=public.normalize_part_lyrics(lyrics,lyrics,id,collection_id,true)
      WHERE id=NEW.song_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER parts_resync AFTER UPDATE ON public.collection_parts FOR EACH ROW EXECUTE FUNCTION public.resync_part_lyrics();
CREATE TRIGGER tracks_parts_resync AFTER INSERT OR UPDATE OF part_ids,kind ON public.audio_tracks FOR EACH ROW EXECUTE FUNCTION public.resync_part_lyrics();

CREATE FUNCTION public.prevent_part_dangling() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME='collection_parts' THEN
    PERFORM 1 FROM public.collections WHERE id=OLD.collection_id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.collections WHERE id=OLD.collection_id) THEN RETURN OLD; END IF;
    IF EXISTS (SELECT 1 FROM public.audio_tracks WHERE OLD.id=ANY(part_ids)) OR EXISTS
      (SELECT 1 FROM public.songs s CROSS JOIN LATERAL public.part_verses(s.lyrics) v WHERE v->'part_ids' ? OLD.id::text)
      OR EXISTS (SELECT 1 FROM public.collection_parts WHERE parent_id=OLD.id) THEN
      RAISE EXCEPTION 'PART_IN_USE: reasigná las letras, pistas y subpartes antes de eliminar';
    END IF;
  ELSE
    PERFORM 1 FROM public.collections c JOIN public.songs s ON s.collection_id=c.id WHERE s.id=OLD.song_id FOR UPDATE OF c;
    IF NOT EXISTS (SELECT 1 FROM public.songs WHERE id=OLD.song_id) THEN RETURN OLD; END IF;
    IF EXISTS (SELECT 1 FROM public.songs s CROSS JOIN LATERAL public.part_verses(s.lyrics) v
      WHERE s.id=OLD.song_id AND v->'audio_track_ids' @> jsonb_build_array(OLD.id)) THEN
      RAISE EXCEPTION 'TRACK_IN_USE: reasigná las letras antes de eliminar la pista';
    END IF;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER parts_delete_guard BEFORE DELETE ON public.collection_parts FOR EACH ROW EXECUTE FUNCTION public.prevent_part_dangling();
CREATE TRIGGER tracks_delete_guard BEFORE DELETE ON public.audio_tracks FOR EACH ROW EXECUTE FUNCTION public.prevent_part_dangling();

-- Canonical colors were already resynced from parts. Do not map those twice
-- (important for swaps/chains whose destination is itself an old palette key).
CREATE FUNCTION public.remap_part_lyric_colors(v jsonb, key_map jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF jsonb_typeof(v)='array' THEN
    SELECT coalesce(jsonb_agg(public.remap_part_lyric_colors(value,key_map) ORDER BY ord),'[]') INTO result
      FROM jsonb_array_elements(v) WITH ORDINALITY x(value,ord);
    RETURN result;
  END IF;
  IF jsonb_typeof(v)='object' AND v ? 'part_ids' AND NOT coalesce((v->>'color_override')::boolean,false) THEN RETURN v; END IF;
  RETURN public.remap_lyric_color_keys(v,key_map);
END $$;

-- Remap parts before verse colors so canonical verses never become exceptions.
CREATE OR REPLACE FUNCTION public.update_collection_palette(p_collection_id bigint,p_hue integer,p_intensity text,p_track_colors jsonb,p_key_map jsonb DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE key_map jsonb := coalesce(p_key_map,'{}');
BEGIN
  IF NOT public.is_collection_admin(p_collection_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_hue IS NULL OR p_hue < 0 OR p_hue > 359
    OR p_intensity IS NULL OR p_intensity NOT IN ('suave','media','intensa')
    OR p_track_colors IS NULL OR jsonb_typeof(p_track_colors)<>'object' OR jsonb_typeof(key_map)<>'object'
    OR EXISTS (SELECT 1 FROM jsonb_each(p_track_colors) t(key,value)
      WHERE NOT public.is_valid_color_spec(t.value) OR t.key !~ '^[a-z0-9_-]{1,32}$') THEN
    RAISE EXCEPTION 'INVALID_PALETTE' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(key_map) m WHERE NOT (p_track_colors ? m.value)) THEN
    RAISE EXCEPTION 'INVALID_PALETTE' USING ERRCODE='22023';
  END IF;
  UPDATE public.collections SET hue=p_hue,intensity=p_intensity,track_colors=p_track_colors WHERE id=p_collection_id;
  UPDATE public.audio_tracks t SET color_key=key_map->>t.color_key FROM public.songs s
    WHERE s.id=t.song_id AND s.collection_id=p_collection_id AND key_map ? t.color_key;
  UPDATE public.collection_parts SET color_key=key_map->>color_key
    WHERE collection_id=p_collection_id AND key_map ? color_key;
  UPDATE public.songs SET lyrics=public.remap_part_lyric_colors(lyrics,key_map)
    WHERE collection_id=p_collection_id AND lyrics IS NOT NULL AND key_map<>'{}';
  IF EXISTS (SELECT 1 FROM public.collection_parts WHERE collection_id=p_collection_id AND NOT (p_track_colors ? color_key))
    OR EXISTS (SELECT 1 FROM public.audio_tracks t JOIN public.songs s ON s.id=t.song_id
      WHERE s.collection_id=p_collection_id AND NOT (p_track_colors ? t.color_key)) THEN
    RAISE EXCEPTION 'KEY_IN_USE' USING ERRCODE='23503';
  END IF;
  IF EXISTS (SELECT 1 FROM public.songs s,
    jsonb_path_query(s.lyrics, 'lax $.**.color_keys[*]') used(key)
    WHERE s.collection_id=p_collection_id AND s.lyrics IS NOT NULL
      AND jsonb_typeof(used.key)='string' AND NOT (p_track_colors ? (used.key #>> '{}'))) THEN
    RAISE EXCEPTION 'KEY_IN_USE_BY_LYRICS' USING ERRCODE='23503';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.update_collection_palette(bigint,integer,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_collection_palette(bigint,integer,text,jsonb,jsonb) TO authenticated;

-- Direct palette writes must also respect part references. Deferred for the RPC.
CREATE FUNCTION public.check_part_palette() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.collection_parts p JOIN public.collections c ON c.id=p.collection_id
    WHERE c.id=NEW.id AND NOT (c.track_colors ? p.color_key)) THEN RAISE EXCEPTION 'KEY_IN_USE'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER parts_palette_integrity AFTER UPDATE ON public.collections
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_part_palette();

-- Settings saves a complete ordered list. Two passes allow parents later in the
-- payload; any invalid reference or referenced deletion rolls back the whole save.
CREATE FUNCTION public.update_collection_parts(p_collection_id bigint, p_parts jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item jsonb; ids uuid[];
BEGIN
  IF NOT public.is_collection_admin(p_collection_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_parts IS NULL OR jsonb_typeof(p_parts)<>'array' THEN RAISE EXCEPTION 'INVALID_PARTS'; END IF;
  PERFORM 1 FROM public.collections WHERE id=p_collection_id FOR UPDATE;
  SELECT coalesce(array_agg((value->>'id')::uuid),'{}') INTO ids FROM jsonb_array_elements(p_parts);
  IF cardinality(ids)<>(SELECT count(DISTINCT id) FROM unnest(ids) x(id)) THEN RAISE EXCEPTION 'INVALID_PARTS'; END IF;
  IF EXISTS (SELECT 1 FROM public.collection_parts WHERE id=ANY(ids) AND collection_id<>p_collection_id) THEN
    RAISE EXCEPTION 'INVALID_PART_IDS';
  END IF;
  UPDATE public.collection_parts SET parent_id=NULL WHERE collection_id=p_collection_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_parts) LOOP
    IF jsonb_typeof(item)<>'object' OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'color_key') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_PARTS'; END IF;
    INSERT INTO public.collection_parts(id,collection_id,name,color_key,"order")
      VALUES ((item->>'id')::uuid,p_collection_id,btrim(item->>'name'),item->>'color_key',coalesce((item->>'order')::integer,0))
      ON CONFLICT (id) DO UPDATE SET name=excluded.name,color_key=excluded.color_key,"order"=excluded."order";
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_parts) LOOP
    IF item->>'parent_id' IS NOT NULL AND NOT ((item->>'parent_id')::uuid=ANY(ids)) THEN RAISE EXCEPTION 'INVALID_PART_PARENT'; END IF;
    UPDATE public.collection_parts SET parent_id=(item->>'parent_id')::uuid WHERE id=(item->>'id')::uuid;
  END LOOP;
  DELETE FROM public.collection_parts WHERE collection_id=p_collection_id AND NOT (id=ANY(ids));
END $$;
REVOKE ALL ON FUNCTION public.update_collection_parts(bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_collection_parts(bigint,jsonb) TO authenticated;

-- One settings draft, one transaction: never publish only half of a palette/part edit.
CREATE FUNCTION public.update_collection_music(p_collection_id bigint,p_hue integer,p_intensity text,p_track_colors jsonb,p_key_map jsonb,p_parts jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_collection_admin(p_collection_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.collections WHERE id=p_collection_id FOR UPDATE;
  PERFORM public.update_collection_palette(p_collection_id,p_hue,p_intensity,p_track_colors,p_key_map);
  PERFORM public.update_collection_parts(p_collection_id,p_parts);
END $$;
REVOKE ALL ON FUNCTION public.update_collection_music(bigint,integer,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_collection_music(bigint,integer,text,jsonb,jsonb,jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.part_verses(jsonb), public.normalize_part_lyrics(jsonb,jsonb,bigint,bigint,boolean),
  public.parts_guard(),public.resync_part_lyrics(),public.prevent_part_dangling(),public.check_part_palette(),
  public.remap_part_lyric_colors(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst, 'reload schema';
