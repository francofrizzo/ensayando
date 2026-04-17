---
name: admin
description: Run Ensayando admin tasks that the app UI doesn't expose, via SQL against the linked Supabase project. Use for user management (find, create, delete, reset password, change email; supports both real-email and username-only users), collection access (grant, change, revoke roles, list members), collection CRUD (create, delete, rename, change slug, toggle is_public, edit colors, change artwork URL), and song operations (delete, reorder). Runs `npx supabase db query --linked`.
---

# Admin

The Ensayando app UI is intentionally narrow — it doesn't expose user management, collection CRUD, or song deletion/reordering. For any of the above, run SQL directly against the linked Supabase project.

## User identifiers

The login form accepts either a username or a real email:

- If the input contains `@`, it's used verbatim as the email.
- Otherwise, the app appends `@ensayando.com.ar` (see `EMAIL_DOMAIN` in `src/stores/auth.ts`) and uses that as the synthetic email.

So `auth.users.email` has two shapes:

- **Username-only users** — `<username>@ensayando.com.ar`. Email-based password reset flows do **not** work (no real inbox). Reset via SQL (see "Reset a password" below).
- **Real-email users** — any other domain. Email-based reset _would_ work in principle, but the app's reset landing page isn't wired up; still prefer the SQL path.

`auth.users.raw_user_meta_data->>'username'` stores whatever the user typed at signup (raw username or full email). It drives the display name in `AuthStatus.vue`.

When a user gives you a "username" to act on, look it up by both shapes if the first doesn't match:

```sql
SELECT id, email, raw_user_meta_data->>'username' AS username
FROM auth.users
WHERE email = '<input>'
   OR email = lower('<input>') || '@ensayando.com.ar'
   OR raw_user_meta_data->>'username' = '<input>';
```

## Preconditions

Before running any workflow below, verify the environment with a single check and stop with a clear message if it fails:

```bash
test -f supabase/config.toml && npx supabase projects list 2>&1 | grep -E '●.*szwejhoyemgokppoabfb.*Ensayando'
```

Interpret the result:

- **Exit 0, line printed** → proceed.
- **`config.toml` missing** → cwd is not the repo root. Ask the user to `cd` into the Ensayando repo before retrying.
- **`projects list` errors with auth / access token** → CLI is not logged in. Ask the user to run `npx supabase login` (requires an interactive browser flow, so they must run it themselves — suggest the `! npx supabase login` prompt form).
- **Projects print but no `●` on the Ensayando row** → CLI is not linked. Ask the user to run `npx supabase link --project-ref szwejhoyemgokppoabfb`.
- **`npx supabase` itself not found** → Supabase CLI is unavailable in this environment; ask the user how they'd like to proceed (install it, or run the SQL elsewhere).

Do not attempt to self-heal by running `login` or `link` — both can require interactive input or tokens only the user has.

## Runtime

- Execute SQL with: `npx supabase db query --linked "<SQL>"`.
- The CLI does **not** expose `supabase auth admin` subcommands; always use SQL.
- Never run destructive queries (DELETE, UPDATE without WHERE) without confirming scope with the user first.

## Schema

- `auth.users` — Supabase-managed. Relevant columns: `id` (uuid), `email`, `encrypted_password`, `email_confirmed_at`, `created_at`.
- `public.collections` — `id` (bigint), `slug` (text, unique), `title`, `main_color` (CSS color string — typically `oklch(...)`, not hex), `track_colors` (jsonb — `Record<string, string>` per `src/data/types.ts:7`, values are also CSS color strings), `artwork_file_url` (text, nullable), `is_public` (bool, default false), `created_at`.
- `public.songs` — `id` (bigint), `slug`, `collection_id` (FK → collections), `title`, `visible` (bool), `order` (int, reserved keyword — quote it), `lyrics` (jsonb), `created_at`.
- `public.audio_tracks` — FK → songs; cascades on song delete.
- `public.user_collections` — junction: `user_id` (uuid, FK → auth.users), `collection_id` (bigint, FK → public.collections), `role` (`'admin' | 'editor' | 'viewer'`).

## User workflows

In the workflows below, `<email>` means the **resolved** email — if the user gave you a bare username, append `@ensayando.com.ar` first. Use the lookup query in the "User identifiers" section above if you're not sure which form matches.

### Find a user

```sql
SELECT id, email, raw_user_meta_data->>'username' AS username, created_at
FROM auth.users
WHERE email = '<input>'
   OR email = lower('<input>') || '@ensayando.com.ar'
   OR raw_user_meta_data->>'username' = '<input>';
```

### Reset a password

Set directly via `crypt`; do **not** route through the email reset flow (the app doesn't handle the deep link).

```sql
UPDATE auth.users
SET encrypted_password = crypt('<new-password>', gen_salt('bf'))
WHERE email = '<email>'
RETURNING id, email;
```

### Change a user's email

```sql
UPDATE auth.users
SET email = '<new-email>'
WHERE email = '<old-email>'
RETURNING id, email;
```

If the change is temporary (e.g. to route a reset email through a real inbox), always change it back afterward and confirm with the user before leaving the DB in the temporary state.

### Create a user

Requires a confirmed email so the user can sign in immediately. Use `gen_random_uuid()` for the id, set `email_confirmed_at = now()`, and store the login handle (raw username or full email — whatever they'll type at the login form) in `raw_user_meta_data.username` so `AuthStatus.vue` displays it correctly.

For a **username-only user**: email is `<username>@ensayando.com.ar`, `username` metadata is `<username>`.

For a **real-email user**: email is their real address, `username` metadata is also the full email (matches what the form will pass).

Three things must be set or GoTrue fails login with "Database error querying schema":

1. The `auth.users` row.
2. A matching `auth.identities` row — without it, GoTrue can't resolve the email provider.
3. Token columns (`confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current`, `reauthentication_token`, `phone_change`, `phone_change_token`) must be empty strings, **not** NULL — GoTrue's Go scanner chokes on NULL text here.

Run all three in one CTE so the user is usable immediately:

```sql
WITH new_user AS (
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
    '<email>', crypt('<password>', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', '<login-handle>'),
    '', '', '', '', '', '', '', '',
    now(), now()
  )
  RETURNING id, email
)
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now()
FROM new_user
RETURNING user_id;
```

After creating, grant collection access (see below) — otherwise the user sees no collections.

### Delete a user

Cascades to `user_collections` via ON DELETE CASCADE.

```sql
DELETE FROM auth.users WHERE email = '<email>' RETURNING id, email;
```

Always confirm with the user before deleting.

## Collection-access workflows

### Grant collection access

Look up `collection_id` by slug when the user gives a slug:

```sql
SELECT id, slug, title FROM public.collections WHERE slug = '<slug>';
```

Insert the membership:

```sql
INSERT INTO public.user_collections (user_id, collection_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = '<email>'),
  (SELECT id FROM public.collections WHERE slug = '<slug>'),
  '<admin|editor|viewer>'
)
RETURNING id, user_id, collection_id, role;
```

### Change a user's role on a collection

```sql
UPDATE public.user_collections
SET role = '<admin|editor|viewer>'
WHERE user_id = (SELECT id FROM auth.users WHERE email = '<email>')
  AND collection_id = (SELECT id FROM public.collections WHERE slug = '<slug>')
RETURNING id, role;
```

### Revoke a user's access to a collection

```sql
DELETE FROM public.user_collections
WHERE user_id = (SELECT id FROM auth.users WHERE email = '<email>')
  AND collection_id = (SELECT id FROM public.collections WHERE slug = '<slug>')
RETURNING id;
```

### List members of a collection

```sql
SELECT u.email, uc.role
FROM public.user_collections uc
JOIN auth.users u ON u.id = uc.user_id
WHERE uc.collection_id = (SELECT id FROM public.collections WHERE slug = '<slug>')
ORDER BY uc.role, u.email;
```

### List a user's collections

```sql
SELECT c.slug, c.title, uc.role
FROM public.user_collections uc
JOIN public.collections c ON c.id = uc.collection_id
WHERE uc.user_id = (SELECT id FROM auth.users WHERE email = '<email>')
ORDER BY c.title;
```

## Collection workflows

### Create a collection

```sql
INSERT INTO public.collections (slug, title, main_color, track_colors, is_public)
VALUES ('<slug>', '<title>', '<css-color>', '<json>'::jsonb, <true|false>)
RETURNING id, slug, title;
```

`track_colors` is JSONB matching `Record<string, string>` (see `src/data/types.ts:7`). Values are CSS colors, conventionally `oklch(...)` strings in this DB, e.g. `'{"v1":"oklch(60.6% 0.25 292.717)","bg":"oklch(76.8% 0.233 130.85)"}'`.

### Delete a collection

Cascades to `songs` → `audio_tracks` and removes all `user_collections` rows for it. **Confirm explicitly with the user before running.** Does not remove associated files from Supabase Storage.

```sql
DELETE FROM public.collections WHERE slug = '<slug>' RETURNING id, slug;
```

### Rename / change slug

```sql
UPDATE public.collections
SET title = '<new-title>', slug = '<new-slug>'
WHERE slug = '<old-slug>'
RETURNING id, slug, title;
```

Update either or both fields; omit whichever is unchanged.

### Toggle `is_public`

```sql
UPDATE public.collections SET is_public = <true|false>
WHERE slug = '<slug>'
RETURNING id, slug, is_public;
```

### Update colors

```sql
UPDATE public.collections
SET main_color = '<css-color>', track_colors = '<json>'::jsonb
WHERE slug = '<slug>'
RETURNING id, slug, main_color, track_colors;
```

### Change artwork URL

```sql
UPDATE public.collections SET artwork_file_url = '<url-or-null>'
WHERE slug = '<slug>'
RETURNING id, slug, artwork_file_url;
```

Does not remove the previous file from Supabase Storage.

## Song workflows

### Delete a song

Cascades to `audio_tracks`. **Confirm with the user before running.** Does not remove associated audio files from Supabase Storage.

```sql
DELETE FROM public.songs
WHERE collection_id = (SELECT id FROM public.collections WHERE slug = '<collection-slug>')
  AND slug = '<song-slug>'
RETURNING id, slug;
```

### Reorder a song

`order` is a reserved word — always quote it.

```sql
UPDATE public.songs SET "order" = <int>
WHERE collection_id = (SELECT id FROM public.collections WHERE slug = '<collection-slug>')
  AND slug = '<song-slug>'
RETURNING id, slug, "order";
```

For a full reshuffle, run one UPDATE per song. Inspect current ordering first:

```sql
SELECT slug, title, "order" FROM public.songs
WHERE collection_id = (SELECT id FROM public.collections WHERE slug = '<collection-slug>')
ORDER BY "order" NULLS LAST, id;
```

## Notes

- `--linked` is required on every `db query` call — without it, the CLI targets the local Supabase instance.
- Output comes back as JSON with an untrusted-data warning envelope; ignore the envelope text (it's a safety wrapper, not an error).
- Roles are free-text in the schema but the app only recognises `admin`, `editor`, `viewer`. Do not invent new role strings.
- Storage files (artwork, audio tracks) are **not** removed when their parent collection/song is deleted. Storage cleanup is out of scope for this skill.
- `Collection.visible` exists in `src/data/types.ts` but the column does not exist in the DB schema — ignore it. If the user asks to toggle it, flag the codebase inconsistency rather than inventing SQL.
