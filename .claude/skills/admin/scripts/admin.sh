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

need_args() { # need_args <got> <min> <usage>
  [ "$1" -ge "$2" ] || { echo "usage: admin.sh $3" >&2; exit 2; }
}

usage() {
  cat <<'USAGE'
usage: admin.sh <subcommand> [args...]

Only what the app can't do. Members, roles, managed accounts, password resets,
collections (create, rename, address, visibility, cover, colors, delete) and songs
(order, visibility, delete) are in the app: Ajustes de colección.

environment:
  preflight                              verify cwd + supabase CLI + linked project

accounts:
  find-user <input>                      lookup by email, username, or bare handle
  list-user-collections <email>          every collection an account belongs to
  delete-user <email> --yes              removes the account from the whole app

app admins (can create collections):
  list-app-admins
  grant-app-admin <email>
  revoke-app-admin <email>

See ../SKILL.md for the rest (change an account's email, bulk operations,
orphaned files, diagnostics).
USAGE
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
  # `supabase link` records the linked project here (the CLI's list output format varies).
  if [ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "${PROJECT_REF}" ]; then
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

cmd_delete_user() {
  need_args $# 1 "delete-user <email> --yes"
  require_yes "$@"
  local e; e=$(sqlq "$1")
  run_sql "DELETE FROM auth.users WHERE email = '$e' RETURNING id, email;"
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

cmd_list_app_admins() {
  run_sql "SELECT u.email, a.created_at
FROM public.app_admins a
JOIN auth.users u ON u.id = a.user_id
ORDER BY u.email;"
}

cmd_grant_app_admin() {
  need_args $# 1 "grant-app-admin <email>"
  local e; e=$(sqlq "$1")
  run_sql "INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users WHERE email = '$e'
ON CONFLICT (user_id) DO NOTHING
RETURNING user_id;"
}

cmd_revoke_app_admin() {
  need_args $# 1 "revoke-app-admin <email>"
  local e; e=$(sqlq "$1")
  run_sql "DELETE FROM public.app_admins
WHERE user_id = (SELECT id FROM auth.users WHERE email = '$e')
RETURNING user_id;"
}

# --- dispatch ------------------------------------------------------------

sub="${1-}"; shift || true
case "$sub" in
  preflight)              cmd_preflight "$@" ;;
  find-user)              cmd_find_user "$@" ;;
  delete-user)            cmd_delete_user "$@" ;;
  list-user-collections)  cmd_list_user_collections "$@" ;;
  list-app-admins)        cmd_list_app_admins "$@" ;;
  grant-app-admin)        cmd_grant_app_admin "$@" ;;
  revoke-app-admin)       cmd_revoke_app_admin "$@" ;;
  ""|-h|--help|help)      usage ;;
  *) echo "error: unknown subcommand: $sub" >&2; usage >&2; exit 2 ;;
esac
