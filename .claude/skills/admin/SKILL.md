---
name: admin
description: Run Ensayando admin tasks that the app UI doesn't expose, via SQL against the linked Supabase project. Use for user management (find, create, delete, reset password, change email; supports both real-email and username-only users), collection access (grant, change, revoke roles, list members), collection CRUD (create, delete, rename, change slug, toggle is_public, edit colors, change artwork URL), and song operations (delete, reorder). Runs `npx supabase db query --linked`.
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
- `Collection.visible` exists in `src/data/types.ts` but the column does not exist in the DB — ignore it. If the user asks to toggle it, flag the codebase inconsistency rather than inventing SQL.

## Schema

- `auth.users` — Supabase-managed. Relevant columns: `id` (uuid), `email`, `encrypted_password`, `email_confirmed_at`, `raw_user_meta_data`, `created_at`.
- `auth.identities` — provider rows. A user needs a matching `email` identity or GoTrue fails login with "Database error querying schema".
- `public.collections` — `id` (bigint), `slug` (text, unique), `title`, `main_color` (CSS color string — typically `oklch(...)`, not hex), `track_colors` (jsonb — `Record<string, string>` per `src/data/types.ts:7`, values are also CSS color strings), `artwork_file_url` (text, nullable), `is_public` (bool, default false), `created_at`.
- `public.songs` — `id` (bigint), `slug`, `collection_id` (FK → collections), `title`, `visible` (bool), `order` (int, reserved keyword — quote it), `lyrics` (jsonb), `created_at`.
- `public.audio_tracks` — FK → songs; cascades on song delete.
- `public.user_collections` — junction: `user_id` (uuid, FK → auth.users, ON DELETE CASCADE), `collection_id` (bigint, FK → public.collections), `role` (`'admin' | 'editor' | 'viewer'`).

## Palette editing (interactive)

For collection colors, use the browser editor rather than hand-writing `UPDATE` statements — the OKLCH picker preserves color-space fidelity that any hex round-trip would lose.

Flow:

1. `scripts/admin.sh edit-palette <slug>` — fetches the current `main_color` + `track_colors`, spawns a local HTTP server, opens the editor in the default browser. Supports editing, adding, removing, and renaming track-color entries.
2. When the user clicks **Save**, the full new palette JSON is printed to stdout (one line, shape: `{"main_color": "...", "track_colors": {...}}`). The script exits 0. **Cancel** or closing the tab exits 2 with no output.
3. Show the user a diff of the change (key renames, added/removed entries, before→after oklch values) and confirm before applying.
4. `scripts/admin.sh apply-palette <slug> '<json>'` — runs the UPDATE. Pass the JSON payload verbatim.

If the user only wants to preview (no edits), they can still use `edit-palette` and click Cancel.

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
INSERT INTO public.collections (slug, title, main_color, track_colors, is_public)
VALUES ('<slug>', '<title>', '<css-color>', '<json>'::jsonb, <true|false>)
RETURNING id, slug, title;
```

`track_colors` is JSONB matching `Record<string, string>`. Values are CSS colors, conventionally `oklch(...)` in this DB, e.g. `'{"v1":"oklch(60.6% 0.25 292.717)","bg":"oklch(76.8% 0.233 130.85)"}'`.

### Rename / change slug / change artwork URL

```sql
UPDATE public.collections
SET title = '<new-title>',             -- optional
    slug = '<new-slug>',               -- optional
    artwork_file_url = '<url-or-null>' -- optional
WHERE slug = '<old-slug>'
RETURNING *;
```

Include only the columns being changed. For `main_color` / `track_colors`, use `admin.sh edit-palette` (see above) instead of hand-writing the UPDATE.

### Reorder songs

`order` is a reserved word — always quote it. Inspect first with `admin.sh list-songs <collection-slug>`, then one UPDATE per song:

```sql
UPDATE public.songs SET "order" = <int>
WHERE collection_id = (SELECT id FROM public.collections WHERE slug = '<collection-slug>')
  AND slug = '<song-slug>'
RETURNING id, slug, "order";
```
