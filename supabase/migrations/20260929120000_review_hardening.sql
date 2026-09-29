-- Hardening from the code review of the redesign (permissions, palette and slugs).
-- See docs/permissions.md.

-- ---------------------------------------------------------------------------
-- 1. Songs and tracks can't be moved into collections the editor doesn't edit.
--    The original UPDATE policies checked the old row only (WITH CHECK true).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated users can update songs in their collections" ON public.songs;
CREATE POLICY "authenticated users can update songs in their collections"
  ON public.songs FOR UPDATE TO authenticated
  USING (public.is_collection_editor(collection_id))
  WITH CHECK (public.is_collection_editor(collection_id));

DROP POLICY IF EXISTS "authenticated users can update audio_tracks to their collection" ON public.audio_tracks;
CREATE POLICY "authenticated users can update audio_tracks to their collection"
  ON public.audio_tracks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.songs s
      WHERE s.id = audio_tracks.song_id AND public.is_collection_editor(s.collection_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.songs s
      WHERE s.id = audio_tracks.song_id AND public.is_collection_editor(s.collection_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Collection admins update only the editable columns. created_by, id and
--    created_at are fixed; colors go through update_collection_palette.
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON public.collections FROM anon, authenticated;
GRANT UPDATE (title, slug, visibility, artwork_file_url, artwork_file_key)
  ON public.collections TO authenticated;

-- Whether a collection has any member at all (security definer: the caller's RLS
-- only shows their own memberships).
CREATE FUNCTION public.collection_has_members(p_collection_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_collections WHERE collection_id = p_collection_id);
$$;

-- The creator can read the row only until the membership trigger has run
-- (INSERT ... RETURNING); afterwards access comes from membership, so a removed
-- creator no longer sees a private collection.
DROP POLICY IF EXISTS "creators can read the collections they created" ON public.collections;
CREATE POLICY "creators can read the collections they are creating"
  ON public.collections FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()) AND NOT public.collection_has_members(id));

-- ---------------------------------------------------------------------------
-- 3. Reserved collection slugs: they collide with top-level routes.
-- ---------------------------------------------------------------------------
UPDATE public.collections
SET slug = slug || '-coleccion'
WHERE slug IN ('login', 'reset-password', 'nueva-coleccion', '404', 'api', 'assets');

ALTER TABLE public.collections
  ADD CONSTRAINT collections_slug_not_reserved
  CHECK (slug NOT IN ('login', 'reset-password', 'nueva-coleccion', '404', 'api', 'assets'));

-- ---------------------------------------------------------------------------
-- 4. Last-admin guard: serialize admin changes per collection, so two admins
--    demoting or removing each other at the same time can't both succeed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.keep_one_collection_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.role <> 'admin' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = 'admin' AND NEW.collection_id = OLD.collection_id THEN
    RETURN NEW;
  END IF;
  -- Cascades from deleting the collection or the account are allowed.
  IF NOT EXISTS (SELECT 1 FROM public.collections WHERE id = OLD.collection_id)
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- Held until the transaction ends. The check below runs with a fresh snapshot
  -- (READ COMMITTED), so it sees a concurrent change that committed while we waited.
  PERFORM pg_advisory_xact_lock(7311, OLD.collection_id::integer);
  IF NOT EXISTS (
    SELECT 1 FROM public.user_collections other
    WHERE other.collection_id = OLD.collection_id AND other.role = 'admin' AND other.id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'LAST_ADMIN' USING
      ERRCODE = 'P0001',
      HINT = 'La colección tiene que tener al menos un admin.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Password resets: a collection admin can't take over another admin or an
--    app admin. Only app admins (or the person themselves) can reset those.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_reset_mode(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_email text;
  managed boolean;
BEGIN
  SELECT u.email INTO target_email FROM auth.users u WHERE u.id = p_user_id;
  IF target_email IS NULL THEN
    RETURN NULL;
  END IF;
  managed := target_email LIKE '%@ensayando.com.ar';

  IF public.is_app_admin() OR p_user_id = (SELECT auth.uid()) THEN
    RETURN CASE WHEN managed THEN 'password' ELSE 'email' END;
  END IF;

  -- Admins (of any collection) and app admins are out of reach for collection admins.
  IF EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = p_user_id)
     OR EXISTS (
       SELECT 1 FROM public.user_collections m WHERE m.user_id = p_user_id AND m.role = 'admin'
     ) THEN
    RETURN NULL;
  END IF;

  IF managed THEN
    IF EXISTS (SELECT 1 FROM public.user_collections m WHERE m.user_id = p_user_id)
       AND NOT EXISTS (
         SELECT 1 FROM public.user_collections m
         WHERE m.user_id = p_user_id AND NOT public.is_collection_admin(m.collection_id)
       ) THEN
      RETURN 'password';
    END IF;
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_collections m
    WHERE m.user_id = p_user_id AND public.is_collection_admin(m.collection_id)
  ) THEN
    RETURN 'email';
  END IF;
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Usernames of managed accounts live in app metadata, which people can't
--    change themselves (user metadata can be rewritten with auth.updateUser).
-- ---------------------------------------------------------------------------
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('username', split_part(email, '@', 1))
WHERE email LIKE '%@ensayando.com.ar'
  AND NOT coalesce(raw_app_meta_data, '{}'::jsonb) ? 'username';

-- Name shown for an account: the managed username, or the email.
CREATE FUNCTION public.account_display_name(p_email text, p_app_meta jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_email LIKE '%@ensayando.com.ar'
      THEN coalesce(p_app_meta ->> 'username', split_part(p_email, '@', 1))
    ELSE p_email
  END;
$$;

CREATE OR REPLACE FUNCTION public.collection_members(p_collection_id bigint)
RETURNS TABLE (
  user_id uuid,
  email text,
  username text,
  is_managed boolean,
  role text,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_collection_admin(p_collection_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id,
           u.email::text,
           public.account_display_name(u.email::text, u.raw_app_meta_data),
           u.email LIKE '%@ensayando.com.ar',
           uc.role,
           u.last_sign_in_at
    FROM public.user_collections uc
    JOIN auth.users u ON u.id = uc.user_id
    WHERE uc.collection_id = p_collection_id
    ORDER BY CASE uc.role WHEN 'admin' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.email;
END;
$$;

-- Exact lookup by email, or by managed username (<user>@ensayando.com.ar).
CREATE OR REPLACE FUNCTION public.find_account(p_query text)
RETURNS TABLE (user_id uuid, email text, username text, is_managed boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  q text := lower(trim(p_query));
BEGIN
  IF NOT (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_collections membership
      WHERE membership.user_id = (SELECT auth.uid()) AND membership.role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF q IS NULL OR length(q) < 3 THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT u.id,
           u.email::text,
           public.account_display_name(u.email::text, u.raw_app_meta_data),
           u.email LIKE '%@ensayando.com.ar'
    FROM auth.users u
    WHERE lower(u.email) = q
       OR lower(u.email) = q || '@ensayando.com.ar'
    LIMIT 5;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Palette: validate what's stored, and never leave verses on a removed key.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.is_valid_color_spec(p_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_value IS NULL OR jsonb_typeof(p_value) <> 'object' THEN false
    WHEN p_value ? 'neutral' THEN p_value = '{"neutral": true}'::jsonb
    ELSE jsonb_typeof(p_value -> 'hue') = 'number'
      AND (p_value ->> 'hue')::numeric = trunc((p_value ->> 'hue')::numeric)
      AND (p_value ->> 'hue')::numeric BETWEEN 0 AND 359
      AND p_value ->> 'intensity' IN ('suave', 'normal', 'intensa')
      AND (SELECT count(*) FROM jsonb_object_keys(p_value)) = 2
  END;
$$;

CREATE OR REPLACE FUNCTION public.update_collection_palette(
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

  IF p_hue IS NULL OR p_hue < 0 OR p_hue > 359
     OR p_intensity IS NULL OR p_intensity NOT IN ('suave', 'normal', 'intensa')
     OR p_track_colors IS NULL OR jsonb_typeof(p_track_colors) <> 'object'
     OR jsonb_typeof(key_map) <> 'object'
     OR EXISTS (
       SELECT 1 FROM jsonb_each(p_track_colors) AS t(key, value)
       WHERE NOT public.is_valid_color_spec(t.value) OR t.key !~ '^[a-z0-9_-]{1,32}$'
     ) THEN
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

  -- Nor any verse.
  IF EXISTS (
    SELECT 1
    FROM public.songs AS song,
         jsonb_path_query(song.lyrics, 'lax $.**.color_keys[*]') AS used(key)
    WHERE song.collection_id = p_collection_id
      AND song.lyrics IS NOT NULL
      AND jsonb_typeof(used.key) = 'string'
      AND NOT (p_track_colors ? (used.key #>> '{}'))
  ) THEN
    RAISE EXCEPTION 'KEY_IN_USE_BY_LYRICS' USING ERRCODE = '23503';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.collection_has_members(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collection_has_members(bigint) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.account_display_name(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_display_name(text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_valid_color_spec(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_color_spec(jsonb) TO authenticated, service_role;
