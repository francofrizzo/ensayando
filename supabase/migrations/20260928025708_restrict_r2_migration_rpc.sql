REVOKE ALL ON FUNCTION public.apply_storage_key_migration(jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_storage_key_migration(jsonb, jsonb) TO service_role;
