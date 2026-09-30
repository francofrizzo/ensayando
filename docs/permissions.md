# Permissions and administration

How access works after the redesign's phase 3, what the migrations fixed, and what the
owner must check before deploying.

## Roles

| Role | Where | Can |
| --- | --- | --- |
| Public | no session | Listen to public and unlisted collections by link. |
| Viewer | `user_collections.role = 'viewer'` | Listen to the collection. |
| Editor | `'editor'` | Also create songs, edit songs and lyrics, remove tracks. |
| Collection admin | `'admin'` | Also rename, change slug and visibility, colors and artwork, order and delete songs, manage members, delete the collection. |
| App admin | `public.app_admins` | Create collections (and become their admin). No automatic access to other collections. |

Every collection keeps at least one admin: the `user_collections_keep_one_admin` trigger
rejects demoting or removing the last one (`LAST_ADMIN`). Deleting the collection or the
account is still allowed.

### Accounts and passwords

- **Managed accounts** are username-only: `<username>@ensayando.com.ar`, no inbox. A
  collection admin can create one bound to their collection and reset its password
  (a new temporary password, shown once) when every collection the account belongs to
  is one they admin. Otherwise only app admins can.
- **Email accounts** can be invited by email. A collection admin can send a recovery
  email to any member of a collection they admin.
- `account_reset_mode(user_id)` decides: `'password'`, `'email'` or `NULL` (not allowed).

## Where each operation lives

| Operation | How | Check |
| --- | --- | --- |
| List members (email, username, account type, last sign-in) | RPC `collection_members` | Collection admin |
| Find an existing account (exact username or email) | RPC `find_account` | Admin of any collection, or app admin |
| Add member, change role, remove | RPCs `add_member`, `set_member_role`, `remove_member` | Collection admin; direct writes to `user_collections` are revoked |
| Order songs | RPC `reorder_songs` (whole order, one transaction) | Collection admin |
| Create collection | `insert` into `collections` | App admin (`created_by` = caller); trigger adds them as admin |
| Rename, slug, visibility, colors, artwork | `update` on `collections` | Collection admin |
| Create managed account, invite, reset password | `POST /api/members` | Checked with the caller's token before using the service role |
| Delete song or collection (+ R2 audio and artwork) | `POST /api/content` | RLS on the caller's own client; R2 cleanup after the rows are gone |
| Remove a track | `delete` on `audio_tracks` | Editor or admin |

Client wrappers for all of these are in `src/data/admin.ts`.

## Schema audit

The migrations started from a dump of the remote schema. Compared with what the app
does, these were missing and are fixed in `20260929100000_schema_integrity.sql` and
`20260929100100_app_admins_and_permissions.sql`:

- **Cascades:** `audio_tracks → songs` and `songs → collections` had no `ON DELETE
  CASCADE`, so deleting a song or collection failed or left orphans.
  (`user_collections → collections` already cascaded.)
- **Delete policies:** no `DELETE` policy existed for `songs`, `audio_tracks` or
  `collections`. The editor's "remove track" (`deleteAudioTracks`) was a silent no-op
  under RLS unless production had policies the migrations don't show.
- **Update policy for collections:** none, so nothing could be edited from the app.
- **Uniqueness:** no unique index on `collections.slug`, `(songs.collection_id, slug)` or
  `(user_collections.user_id, collection_id)`, and no check on `user_collections.role`.
- **Member listing:** `user_collections` is only readable by its own user, so admins
  couldn't see members; `collection_members` covers it.
- **Reserved song slugs:** `nueva`, `ajustes` and `editar` collide with new routes.
  Existing songs with those slugs get `-cancion` appended.
- **`songs.duration`:** new; backfilled from `audio_tracks.peaks.duration`.

## Before deploying (owner)

1. **Diff production against the migrations.** They may not reflect production (the
   dump could predate manual changes). Run `npx supabase db diff --linked` and review
   it before `db push`. In particular check for duplicate slugs or memberships: the
   unique indexes fail to build if production has duplicates.
2. **Check reserved collection slugs:** collections whose slug is `login`,
   `reset-password`, `nueva-coleccion`, `404`, `api` or `assets` get `-coleccion`
   appended (their links change).
3. **Set `SUPABASE_SERVICE_ROLE_KEY` and `APP_URL`** in the Vercel project (production
   and preview). `/api/members` needs the key to create accounts, reset passwords and
   send invitations. In production `APP_URL` (e.g. `https://ensayando.com.ar`) is
   required for the links in those emails: without it the actions fail instead of
   trusting the request's `Origin`. Keep the Supabase redirect allow-list strict (no
   wildcards such as `*.vercel.app`).
5. **Check Supabase email delivery (SMTP)** for invitations and recovery emails.
6. **Add the first app admins:**
   `insert into public.app_admins (user_id) select id from auth.users where email = '…';`

## Tests

```bash
pnpm test                       # handlers with mocked Supabase and R2 (tests/api)
npx supabase start              # local only
SUPABASE_DB_TEST=1 pnpm test:db # RLS, RPCs and account flows against local Supabase
```

`pnpm test:db` reads `SUPABASE_TEST_URL` (default `http://127.0.0.1:54321`) and the
standard local keys. It never targets a linked project.

## Local development

`pnpm dev` serves the functions in `api/` from the Vite dev server (`server/dev-api.ts`), so settings, members and deletions work without `vercel dev`. Start local Supabase and pass the local keys:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=<anon key from `npx supabase status`> \
SUPABASE_SERVICE_ROLE_KEY=<service role key from `npx supabase status`> \
pnpm dev
```

Uploads (audio, artwork) also need the `R2_*` variables; without them the rest of the settings still work.
