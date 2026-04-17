#!/usr/bin/env bash
# Ensayando admin helpers. Wraps `npx supabase db query --linked` for the
# mechanical SQL flows that live in ../SKILL.md. Read the skill for the
# judgment calls (when to confirm, username vs email shapes, etc.).
set -euo pipefail

PROJECT_REF="szwejhoyemgokppoabfb"

# --- helpers -------------------------------------------------------------

sqlq() { printf "%s" "$1" | sed "s/'/''/g"; }
run_sql() { npx supabase db query --linked "$1"; }

require_yes() {
  for a in "$@"; do [ "$a" = "--yes" ] && return 0; done
  echo "error: refusing destructive op without --yes" >&2; exit 2
}

require_role() {
  case "$1" in admin|editor|viewer) ;; *)
    echo "error: role must be admin|editor|viewer (got: $1)" >&2; exit 2 ;;
  esac
}

require_bool() {
  case "$1" in true|false) ;; *)
    echo "error: expected true|false (got: $1)" >&2; exit 2 ;;
  esac
}

need_args() { # need_args <got> <min> <usage>
  [ "$1" -ge "$2" ] || { echo "usage: admin.sh $3" >&2; exit 2; }
}

usage() {
  cat <<'EOF'
usage: admin.sh <subcommand> [args...]

environment:
  preflight                              verify cwd + supabase CLI + linked project

users:
  find-user <input>                      lookup by email, username, or bare handle
  create-user <email> <password> <handle>
                                         full CTE: users + identities + empty tokens
  reset-password <email> <new-password>  set via crypt+gen_salt
  delete-user <email> --yes              cascades to user_collections

collection access:
  grant-access <email> <slug> <role>     role: admin|editor|viewer
  change-role <email> <slug> <role>
  revoke-access <email> <slug>
  list-members <slug>
  list-user-collections <email>

collections:
  toggle-public <slug> <true|false>
  delete-collection <slug> --yes         cascades to songs/tracks; no storage cleanup
  edit-palette <slug>                    open browser oklch editor; prints new palette JSON on save
  apply-palette <slug> <json>            UPDATE main_color + track_colors (payload from edit-palette)

songs:
  list-songs <collection-slug>           inspect current ordering
  delete-song <collection-slug> <song-slug> --yes

See ../SKILL.md for non-extracted flows (create/rename/recolor collection,
change user email, reorder songs, update artwork URL).
EOF
}

# --- subcommands ---------------------------------------------------------

cmd_preflight() {
  if [ ! -f supabase/config.toml ]; then
    echo "error: supabase/config.toml missing — cwd is not the Ensayando repo root" >&2; exit 1
  fi
  command -v npx >/dev/null 2>&1 || { echo "error: npx not found" >&2; exit 1; }
  local out
  out=$(npx supabase projects list 2>&1) || {
    echo "$out" >&2
    echo "error: 'supabase projects list' failed — ask user to run: npx supabase login" >&2; exit 1
  }
  if ! echo "$out" | grep -qE "●.*${PROJECT_REF}.*Ensayando"; then
    echo "$out" >&2
    echo "error: Ensayando not linked — ask user to run: npx supabase link --project-ref ${PROJECT_REF}" >&2
    exit 1
  fi
  echo "ok"
}

cmd_find_user() {
  need_args $# 1 "find-user <input>"
  local i; i=$(sqlq "$1")
  run_sql "SELECT id, email, raw_user_meta_data->>'username' AS username, created_at
FROM auth.users
WHERE email = '$i'
   OR email = lower('$i') || '@ensayando.com.ar'
   OR raw_user_meta_data->>'username' = '$i';"
}

cmd_create_user() {
  need_args $# 3 "create-user <email> <password> <handle>"
  local e p h
  e=$(sqlq "$1"); p=$(sqlq "$2"); h=$(sqlq "$3")
  run_sql "WITH new_user AS (
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    reauthentication_token, phone_change, phone_change_token,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    '$e', crypt('$p', gen_salt('bf')), now(),
    '{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb,
    jsonb_build_object('username', '$h'),
    '', '', '', '', '', '', '', '',
    now(), now()
  )
  RETURNING id, email
)
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now()
FROM new_user
RETURNING user_id;"
}

cmd_reset_password() {
  need_args $# 2 "reset-password <email> <new-password>"
  local e p; e=$(sqlq "$1"); p=$(sqlq "$2")
  run_sql "UPDATE auth.users
SET encrypted_password = crypt('$p', gen_salt('bf'))
WHERE email = '$e'
RETURNING id, email;"
}

cmd_delete_user() {
  need_args $# 1 "delete-user <email> --yes"
  require_yes "$@"
  local e; e=$(sqlq "$1")
  run_sql "DELETE FROM auth.users WHERE email = '$e' RETURNING id, email;"
}

cmd_grant_access() {
  need_args $# 3 "grant-access <email> <slug> <role>"
  require_role "$3"
  local e s r; e=$(sqlq "$1"); s=$(sqlq "$2"); r=$(sqlq "$3")
  run_sql "INSERT INTO public.user_collections (user_id, collection_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = '$e'),
  (SELECT id FROM public.collections WHERE slug = '$s'),
  '$r'
)
RETURNING id, user_id, collection_id, role;"
}

cmd_change_role() {
  need_args $# 3 "change-role <email> <slug> <role>"
  require_role "$3"
  local e s r; e=$(sqlq "$1"); s=$(sqlq "$2"); r=$(sqlq "$3")
  run_sql "UPDATE public.user_collections
SET role = '$r'
WHERE user_id = (SELECT id FROM auth.users WHERE email = '$e')
  AND collection_id = (SELECT id FROM public.collections WHERE slug = '$s')
RETURNING id, role;"
}

cmd_revoke_access() {
  need_args $# 2 "revoke-access <email> <slug>"
  local e s; e=$(sqlq "$1"); s=$(sqlq "$2")
  run_sql "DELETE FROM public.user_collections
WHERE user_id = (SELECT id FROM auth.users WHERE email = '$e')
  AND collection_id = (SELECT id FROM public.collections WHERE slug = '$s')
RETURNING id;"
}

cmd_list_members() {
  need_args $# 1 "list-members <slug>"
  local s; s=$(sqlq "$1")
  run_sql "SELECT u.email, uc.role
FROM public.user_collections uc
JOIN auth.users u ON u.id = uc.user_id
WHERE uc.collection_id = (SELECT id FROM public.collections WHERE slug = '$s')
ORDER BY uc.role, u.email;"
}

cmd_list_user_collections() {
  need_args $# 1 "list-user-collections <email>"
  local e; e=$(sqlq "$1")
  run_sql "SELECT c.slug, c.title, uc.role
FROM public.user_collections uc
JOIN public.collections c ON c.id = uc.collection_id
WHERE uc.user_id = (SELECT id FROM auth.users WHERE email = '$e')
ORDER BY c.title;"
}

cmd_toggle_public() {
  need_args $# 2 "toggle-public <slug> <true|false>"
  require_bool "$2"
  local s; s=$(sqlq "$1")
  run_sql "UPDATE public.collections SET is_public = $2
WHERE slug = '$s'
RETURNING id, slug, is_public;"
}

cmd_delete_collection() {
  need_args $# 1 "delete-collection <slug> --yes"
  require_yes "$@"
  local s; s=$(sqlq "$1")
  run_sql "DELETE FROM public.collections WHERE slug = '$s' RETURNING id, slug;"
}

cmd_edit_palette() {
  need_args $# 1 "edit-palette <slug>"
  node "$(dirname "$0")/palette-editor.mjs" "$1"
}

cmd_apply_palette() {
  need_args $# 2 "apply-palette <slug> <json>"
  local s j main tracks
  s=$(sqlq "$1")
  j="$2"
  # Validate + extract fields with node to avoid shell-quoting the JSON.
  main=$(node -e '
    const p = JSON.parse(process.argv[1]);
    if (typeof p.main_color !== "string") { process.stderr.write("missing main_color\n"); process.exit(2); }
    if (!p.track_colors || typeof p.track_colors !== "object") { process.stderr.write("missing track_colors\n"); process.exit(2); }
    process.stdout.write(p.main_color);
  ' "$j")
  tracks=$(node -e '
    const p = JSON.parse(process.argv[1]);
    process.stdout.write(JSON.stringify(p.track_colors));
  ' "$j")
  local main_q tracks_q
  main_q=$(sqlq "$main")
  tracks_q=$(sqlq "$tracks")
  run_sql "UPDATE public.collections
SET main_color = '$main_q',
    track_colors = '$tracks_q'::jsonb
WHERE slug = '$s'
RETURNING id, slug, main_color, track_colors;"
}

cmd_list_songs() {
  need_args $# 1 "list-songs <collection-slug>"
  local s; s=$(sqlq "$1")
  run_sql "SELECT slug, title, \"order\" FROM public.songs
WHERE collection_id = (SELECT id FROM public.collections WHERE slug = '$s')
ORDER BY \"order\" NULLS LAST, id;"
}

cmd_delete_song() {
  need_args $# 2 "delete-song <collection-slug> <song-slug> --yes"
  require_yes "$@"
  local c s; c=$(sqlq "$1"); s=$(sqlq "$2")
  run_sql "DELETE FROM public.songs
WHERE collection_id = (SELECT id FROM public.collections WHERE slug = '$c')
  AND slug = '$s'
RETURNING id, slug;"
}

# --- dispatch ------------------------------------------------------------

sub="${1-}"; shift || true
case "$sub" in
  preflight)              cmd_preflight "$@" ;;
  find-user)              cmd_find_user "$@" ;;
  create-user)            cmd_create_user "$@" ;;
  reset-password)         cmd_reset_password "$@" ;;
  delete-user)            cmd_delete_user "$@" ;;
  grant-access)           cmd_grant_access "$@" ;;
  change-role)            cmd_change_role "$@" ;;
  revoke-access)          cmd_revoke_access "$@" ;;
  list-members)           cmd_list_members "$@" ;;
  list-user-collections)  cmd_list_user_collections "$@" ;;
  toggle-public)          cmd_toggle_public "$@" ;;
  delete-collection)      cmd_delete_collection "$@" ;;
  edit-palette)           cmd_edit_palette "$@" ;;
  apply-palette)          cmd_apply_palette "$@" ;;
  list-songs)             cmd_list_songs "$@" ;;
  delete-song)            cmd_delete_song "$@" ;;
  ""|-h|--help|help)      usage ;;
  *) echo "error: unknown subcommand: $sub" >&2; usage >&2; exit 2 ;;
esac
