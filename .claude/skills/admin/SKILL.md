---
name: admin
description: Run Ensayando admin tasks that the app UI doesn't expose, via SQL against the linked Supabase project. Use for user management (find, create, delete, reset password, change email; supports both real-email and username-only users), collection access (grant, change, revoke roles, list members), collection CRUD (create, delete, rename, change slug, set visibility private/unlisted/public, change artwork URL), and song operations (delete, reorder). Runs `npx supabase db query --linked`.
---

# Admin

The Ensayando app UI is intentionally narrow — it doesn't expose user management, collection CRUD, or song deletion/reordering. For any of the above, run SQL directly against the linked Supabase project.

## Entry point

The common flows are wrapped in `scripts/admin.sh`. Run `scripts/admin.sh` with no args (or `help`) to see the subcommand list. Always `scripts/admin.sh preflight` first — it verifies cwd + CLI login + linked project and prints actionable errors otherwise (do **not** try to self-heal `login` or `link`; they need the user).

For flows not covered by the script (listed at the bottom), hand-write SQL and run it with `npx supabase db query --linked "<SQL>"`.

## User identifiers

The login form accepts either a username or a real email:

- If the input contains `@`, it's used verbatim.
- Otherwise, the app appends `@ensayando.com.ar` (see `EMAIL_DOMAIN` in `src/stores/auth.ts`) and uses that as a synthetic email.

So `auth.users.email` has two shapes:

- **Username-only users** — `<username>@ensayando.com.ar`. Email-based password reset flows do **not** work (no real inbox). The login UI detects these and shows "Tu cuenta es administrada manualmente. Pedile al administrador que te la resetee." — reset via SQL (`admin.sh reset-password`).
- **Real-email users** — any other domain. The app has a self-serve password reset (`LoginView.vue` "¿Olvidaste tu contraseña?" → `ResetPasswordView.vue`). Only use `admin.sh reset-password` if the user can't receive the email.

`auth.users.raw_user_meta_data->>'username'` stores whatever the user typed at signup (raw username or full email). It drives the display name in `AuthStatus.vue`.

When a user gives you a "username" to act on, use `admin.sh find-user <input>` — it looks up by all three shapes at once.

## Runtime notes

- The Supabase CLI does **not** expose `supabase auth admin` subcommands; always use SQL.
- Destructive ops (`delete-user`, `delete-collection`, `delete-song`) require an explicit `--yes` flag. **Always confirm with the user before passing it.**
- For ad-hoc SQL, `--linked` is required on every `db query` call — without it the CLI targets local Supabase.
- Query output comes back wrapped in an untrusted-data safety envelope; ignore the wrapper text.
- Storage files (artwork, audio tracks) are **not** removed when their parent collection/song is deleted. Storage cleanup is out of scope.
- Roles are free-text in the schema but the app only recognises `admin`, `editor`, `viewer`. Do not invent new role strings.
- Collection visibility is the `visibility` column (`'private' | 'unlisted' | 'public'`). `private` = members only; `unlisted` = readable by anyone with the link but hidden from sidebar listings; `public` = listed for everyone. RLS treats `unlisted` and `public` the same (both link-readable); the listing/sidebar distinction is enforced client-side. Use `admin.sh set-visibility <slug> <value>`.

## Schema

- `auth.users` — Supabase-managed. Relevant columns: `id` (uuid), `email`, `encrypted_password`, `email_confirmed_at`, `raw_user_meta_data`, `created_at`.
- `auth.identities` — provider rows. A user needs a matching `email` identity or GoTrue fails login with "Database error querying schema".
- `public.collections` — `id` (bigint), `slug` (text, unique), `title`, `hue` (smallint 0–359, not null), `intensity` (text: `'suave' | 'normal' | 'intensa'`, default `'normal'`), `track_colors` (jsonb — `Record<string, {hue, intensity} | {neutral: true}>` per `src/data/types.ts`), `artwork_file_url` (text, nullable), `visibility` (text: `'private' | 'unlisted' | 'public'`, default `'private'`, CHECK-constrained), `created_at`.
- `public.songs` — `id` (bigint), `slug`, `collection_id` (FK → collections), `title`, `visible` (bool), `order` (int, reserved keyword — quote it), `lyrics` (jsonb), `created_at`.
- `public.audio_tracks` — FK → songs; cascades on song delete.
- `public.user_collections` — junction: `user_id` (uuid, FK → auth.users, ON DELETE CASCADE), `collection_id` (bigint, FK → public.collections), `role` (`'admin' | 'editor' | 'viewer'`).

## Colors

Colors belong to the app's collection settings (Ajustes de colección › Colores; until that screen ships, a plain `UPDATE public.collections SET hue = …, intensity = …, track_colors = … WHERE slug = …` does it). A collection stores only a `hue` and an `intensity`; each `track_colors` entry is `{"hue": <0–359>, "intensity": "suave"|"normal"|"intensa"}` or `{"neutral": true}`. Every displayed color is derived from those in `src/utils/palette.ts`, so there is nothing to tune by hand here.

## Non-extracted flows

These vary too much per call to script — write SQL inline. For each, the resolved `<email>` is the synthetic `<username>@ensayando.com.ar` for username-only users, otherwise the real address.

### Change a user's email

```sql
UPDATE auth.users SET email = '<new-email>'
WHERE email = '<old-email>'
RETURNING id, email;
```

If this is temporary (e.g. to route a reset email through a real inbox), always change it back afterward and confirm with the user before leaving the DB in the temporary state.

### Create a collection

```sql
INSERT INTO public.collections (slug, title, hue, intensity, track_colors, visibility)
VALUES ('<slug>', '<title>', <hue 0–359>, '<suave|normal|intensa>', '<json>'::jsonb, '<private|unlisted|public>')
RETURNING id, slug, title, visibility;
```

`track_colors` maps each color key to a hue spec, e.g. `'{"v1":{"hue":293,"intensity":"intensa"},"click":{"neutral":true}}'`. Keep tracks at least 25° of hue apart so they stay distinguishable.

### Rename / change slug / change artwork URL

```sql
UPDATE public.collections
SET title = '<new-title>',             -- optional
    slug = '<new-slug>',               -- optional
    artwork_file_url = '<url-or-null>' -- optional
WHERE slug = '<old-slug>'
RETURNING *;
```

Include only the columns being changed. Colors are edited in the app (see **Colors**).

### Reorder songs

`order` is a reserved word — always quote it. Inspect first with `admin.sh list-songs <collection-slug>`, then one UPDATE per song:

```sql
UPDATE public.songs SET "order" = <int>
WHERE collection_id = (SELECT id FROM public.collections WHERE slug = '<collection-slug>')
  AND slug = '<song-slug>'
RETURNING id, slug, "order";
```
