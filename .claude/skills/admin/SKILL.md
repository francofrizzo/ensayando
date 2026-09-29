---
name: admin
description: Run the few Ensayando admin tasks the app can't do, via SQL against the linked Supabase project. Use to make someone an app admin (they can create collections), delete an account from the whole app, change an account's email, look up which collections an account is in, bulk operations, cleaning orphaned storage files, and ad-hoc diagnostics. Members, roles, managed accounts, password resets, collection settings and song order/deletion are in the app (Ajustes de colección), not here. Runs `npx supabase db query --linked`.
---

# Admin

Almost all administration lives in the app now, under **Ajustes de colección** (`/:colección/ajustes`, for the collection's admins) and **Nueva colección** (`/nueva-coleccion`, for app admins):

- Members: add existing accounts, create managed accounts, invite by email, change roles, remove access, reset passwords (a new temporary password for managed accounts, a recovery email otherwise).
- Collection: name, address (slug), visibility, cover, colors (hue and intensity per track), deletion.
- Songs: order, visibility, deletion (audio files are removed from R2 too).

Point people there first. This skill covers what's left.

## Entry point

The flows are wrapped in `scripts/admin.sh`. Run `scripts/admin.sh` with no args (or `help`) to see the subcommand list. Always `scripts/admin.sh preflight` first — it verifies cwd + CLI login + linked project and prints actionable errors otherwise (do **not** try to self-heal `login` or `link`; they need the user).

For flows not covered by the script, hand-write SQL and run it with `npx supabase db query --linked "<SQL>"`.

## App admins

`public.app_admins` lists who can create collections (and so become the admin of the ones they create). It isn't editable from the app, on purpose.

- `admin.sh list-app-admins`
- `admin.sh grant-app-admin <email>`
- `admin.sh revoke-app-admin <email>`

An app admin does **not** see every collection: only the ones they are a member of.

## User identifiers

The login form accepts either a username or a real email:

- If the input contains `@`, it's used verbatim.
- Otherwise, the app appends `@ensayando.com.ar` (see `EMAIL_DOMAIN` in `src/stores/auth.ts`).

So `auth.users.email` has two shapes:

- **Managed accounts** — `<username>@ensayando.com.ar`, no real inbox. Their passwords are reset by a collection admin in Miembros.
- **Real-email accounts** — self-serve reset from the login screen, or a recovery email sent from Miembros.

`auth.users.raw_user_meta_data->>'username'` holds the display name. When someone gives you a "username", use `admin.sh find-user <input>`: it looks up all three shapes at once.

## Runtime notes

- The Supabase CLI does **not** expose `supabase auth admin` subcommands; use SQL.
- `delete-user` requires `--yes`. **Always confirm with the user before passing it.** It removes the account from every collection; the "at least one admin" guard doesn't block it, so check `list-user-collections` first and make sure no collection is left without an admin.
- `--linked` is required on every ad-hoc `db query` call — without it the CLI targets local Supabase.
- Query output comes back wrapped in an untrusted-data safety envelope; ignore the wrapper text.

## Schema

- `auth.users` — `id` (uuid), `email`, `encrypted_password`, `email_confirmed_at`, `raw_user_meta_data`, `last_sign_in_at`, `created_at`.
- `auth.identities` — provider rows. A user needs a matching `email` identity or GoTrue fails login with "Database error querying schema".
- `public.app_admins` — `user_id` (pk, FK → auth.users, on delete cascade), `created_at`.
- `public.collections` — `id`, `slug` (unique), `title`, `hue` (0–359), `intensity` (`suave | normal | intensa`), `track_colors` (jsonb: key → `{hue, intensity}` or `{neutral: true}`), `artwork_file_key`, `visibility` (`private | unlisted | public`), `created_by`, `created_at`.
- `public.songs` — `id`, `slug` (unique per collection; `nueva`, `ajustes`, `editar` are reserved), `collection_id`, `title`, `visible`, `order` (quote it), `lyrics` (jsonb), `duration`, `created_at`.
- `public.audio_tracks` — FK → songs, cascades on song delete.
- `public.user_collections` — `user_id`, `collection_id`, `role` (`admin | editor | viewer`). At least one admin per collection is enforced by a trigger.

See `docs/permissions.md` for the RLS policies and database functions behind the app's settings.

## Flows without a script

### Change an account's email

```sql
UPDATE auth.users SET email = '<new-email>'
WHERE email = '<old-email>'
RETURNING id, email;
```

Also update the matching `auth.identities` row (`identity_data->>'email'`). If this is temporary (e.g. to route a recovery email through a real inbox), change it back afterward and confirm with the user before leaving it in the temporary state.

### Bulk operations

Importing many people or songs at once isn't in the app. Write the SQL per case, show the user the exact statements and a count of affected rows before running them, and prefer one transaction.

### Orphaned storage files

Deleting songs and collections from the app removes their R2 objects; when some can't be removed, the app reports them (`orphanedKeys`). Files orphaned before that (or listed in such a report) can be found by comparing R2 keys (`audio/<collection-id>/…`, `artwork/<collection-id>/…`) with `audio_tracks.audio_file_key` and `collections.artwork_file_key`, and deleted with the helpers in `server/storage/r2.ts`. Confirm the list with the user before deleting anything.

### Diagnostics

Anything else: read-only SQL first (`SELECT …`), show the result, then propose changes.
