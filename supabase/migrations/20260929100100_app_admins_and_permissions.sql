-- In-app administration (redesign, phase 3): app admins, collection admin powers,
-- member management RPCs and song ordering.
--
-- Roles:
--   * App admin (public.app_admins): may create collections. Creating one makes
--     them its admin; app admins do not see every collection automatically.
--   * Collection admin: manages the collection (name, slug, visibility, colors,
--     artwork, song order and deletion) and its members.
--   * Editor: edits songs and lyrics, creates songs, removes tracks.
--   * Viewer: listens.
-- Every collection keeps at least one admin.

-- ---------------------------------------------------------------------------
-- App admins
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- A person can see whether they are an app admin; nobody can write through the API.
CREATE POLICY "users can read their own app admin row"
  ON public.app_admins FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.app_admins FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can use them without recursing into
-- user_collections RLS)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = (SELECT auth.uid()));
$$;

CREATE FUNCTION public.collection_role(p_collection_id bigint)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.user_collections
  WHERE collection_id = p_collection_id AND user_id = (SELECT auth.uid());
$$;

CREATE FUNCTION public.is_collection_admin(p_collection_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(public.collection_role(p_collection_id) = 'admin', false);
$$;

CREATE FUNCTION public.is_collection_editor(p_collection_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(public.collection_role(p_collection_id) IN ('admin', 'editor'), false);
$$;

-- ---------------------------------------------------------------------------
-- Collections: app admins create, collection admins update and delete
-- ---------------------------------------------------------------------------
-- Who created each collection. Also lets the creator read the row it just inserted
-- (INSERT ... RETURNING checks read access before the membership trigger runs).
ALTER TABLE public.collections
  ADD COLUMN created_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE POLICY "app admins can create collections"
  ON public.collections FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin() AND created_by = (SELECT auth.uid()));

CREATE POLICY "creators can read the collections they created"
  ON public.collections FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

CREATE POLICY "collection admins can update their collections"
  ON public.collections FOR UPDATE TO authenticated
  USING (public.is_collection_admin(id))
  WITH CHECK (public.is_collection_admin(id));

CREATE POLICY "collection admins can delete their collections"
  ON public.collections FOR DELETE TO authenticated
  USING (public.is_collection_admin(id));

-- The creator becomes the collection's admin.
CREATE FUNCTION public.add_creator_as_collection_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    INSERT INTO public.user_collections (user_id, collection_id, role)
    VALUES ((SELECT auth.uid()), NEW.id, 'admin')
    ON CONFLICT (user_id, collection_id) DO UPDATE SET role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER collections_add_creator_as_admin
  AFTER INSERT ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_collection_admin();

-- ---------------------------------------------------------------------------
-- Songs and tracks: deletion
-- ---------------------------------------------------------------------------
CREATE POLICY "collection admins can delete songs"
  ON public.songs FOR DELETE TO authenticated
  USING (public.is_collection_admin(collection_id));

CREATE POLICY "collection editors can delete audio_tracks"
  ON public.audio_tracks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.songs s
      WHERE s.id = audio_tracks.song_id AND public.is_collection_editor(s.collection_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Memberships: writes only through the RPCs below. Every collection keeps an admin.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.user_collections FROM anon, authenticated;

CREATE FUNCTION public.keep_one_collection_admin()
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

CREATE TRIGGER user_collections_keep_one_admin
  BEFORE UPDATE OR DELETE ON public.user_collections
  FOR EACH ROW EXECUTE FUNCTION public.keep_one_collection_admin();

-- Members of a collection, with account details from auth.users.
CREATE FUNCTION public.collection_members(p_collection_id bigint)
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
           coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1))::text,
           u.email LIKE '%@ensayando.com.ar',
           uc.role,
           u.last_sign_in_at
    FROM public.user_collections uc
    JOIN auth.users u ON u.id = uc.user_id
    WHERE uc.collection_id = p_collection_id
    ORDER BY CASE uc.role WHEN 'admin' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.email;
END;
$$;

CREATE FUNCTION public.assert_valid_role(p_role text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_role IS NULL OR p_role NOT IN ('admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'INVALID_ROLE' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE FUNCTION public.add_member(p_collection_id bigint, p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_collection_admin(p_collection_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_valid_role(p_role);
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_collections
    WHERE collection_id = p_collection_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.user_collections (user_id, collection_id, role)
  VALUES (p_user_id, p_collection_id, p_role);
END;
$$;

CREATE FUNCTION public.set_member_role(p_collection_id bigint, p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_collection_admin(p_collection_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_valid_role(p_role);
  UPDATE public.user_collections
  SET role = p_role
  WHERE collection_id = p_collection_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE FUNCTION public.remove_member(p_collection_id bigint, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_collection_admin(p_collection_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_collections
  WHERE collection_id = p_collection_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- Exact lookup of an existing account, to add it to a collection. Matches the
-- email, the username shape used by the login form (<user>@ensayando.com.ar) or
-- the stored username. Never lists partial matches.
CREATE FUNCTION public.find_account(p_query text)
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
           coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1))::text,
           u.email LIKE '%@ensayando.com.ar'
    FROM auth.users u
    WHERE lower(u.email) = q
       OR lower(u.email) = q || '@ensayando.com.ar'
       OR lower(u.raw_user_meta_data ->> 'username') = q
    LIMIT 5;
END;
$$;

-- How the caller may reset an account's password:
--   'password' -> set a new temporary password (managed accounts, which have no inbox):
--                 app admins, or collection admins when every membership of the account
--                 is in a collection they admin.
--   'email'    -> send a recovery email (accounts with a real email): app admins, or
--                 admins of any collection the account belongs to.
--   NULL       -> not allowed.
CREATE FUNCTION public.account_reset_mode(p_user_id uuid)
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

  IF public.is_app_admin() THEN
    RETURN CASE WHEN managed THEN 'password' ELSE 'email' END;
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
-- Song order
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reorder_songs(p_collection_id bigint, p_song_ids bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_collection_admin(p_collection_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_song_ids IS NULL
     OR cardinality(p_song_ids)
        <> (SELECT count(DISTINCT given.song_id) FROM unnest(p_song_ids) AS given(song_id))
     OR (SELECT count(*) FROM public.songs s WHERE s.collection_id = p_collection_id)
        <> cardinality(p_song_ids)
     OR EXISTS (
       SELECT 1 FROM unnest(p_song_ids) AS given(song_id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.songs s
         WHERE s.id = given.song_id AND s.collection_id = p_collection_id
       )
     ) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING
      ERRCODE = '22023',
      HINT = 'El orden tiene que incluir cada canción de la colección una sola vez.';
  END IF;
  UPDATE public.songs AS song
  SET "order" = ordered.position
  FROM unnest(p_song_ids) WITH ORDINALITY AS ordered(song_id, position)
  WHERE song.id = ordered.song_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants: RPCs only for signed-in people
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.collection_role(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_collection_admin(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_collection_editor(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_creator_as_collection_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.keep_one_collection_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_valid_role(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.collection_members(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_member(bigint, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_member_role(bigint, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_member(bigint, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_account(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.account_reset_mode(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reorder_songs(bigint, bigint[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.collection_role(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_collection_admin(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_collection_editor(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_valid_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.collection_members(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_member(bigint, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(bigint, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.account_reset_mode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_songs(bigint, bigint[]) TO authenticated;
