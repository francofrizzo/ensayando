# Ensayando

Multitrack audio player with synchronized lyrics for musical rehearsals. Vue 3 SPA + Supabase backend, deployed on Vercel.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # type-check + vite build
npm run type-check   # vue-tsc --build --force
npm run lint         # eslint --fix
npm run format       # prettier --write src/
npm test             # vitest run (all tests)
npm run test:watch   # vitest in watch mode
```

After non-trivial changes, run `type-check`, `lint`, and `test` before presenting work as done.

## Stack

Vue 3 (Composition API + `<script setup>`) · TypeScript · Vite · Tailwind CSS 4 + DaisyUI 5 · Pinia · Vue Router · Supabase (auth, DB, storage) · WaveSurfer (audio) · PWA (vite-plugin-pwa) · Vercel

## Architecture

```
Views ──► Composables ──► Stores (Pinia) ──► data/supabase.ts ──► Supabase client
                                             data/storage.ts   ──► Supabase Storage
```

- **Views** (`src/views/`): route-level pages — `HomeView`, `CollectionView`, `SongView`, `LoginView`.
- **Components** (`src/components/`): organized by domain — `player/`, `editor/`, `lyrics/`, `navigation/`, `auth/`, `ui/`.
- **Composables** (`src/composables/`): reusable logic extracted from components. Lyrics editing is split across several composables (`useLyricsEditor`, `useLyricsOperations`, `useLyricsTimestamps`, etc.).
- **Stores** (`src/stores/`): `collections` (songs, lyrics, undo/redo), `auth`, `ui`.
- **Data layer** (`src/data/`): `supabase.ts` wraps all Supabase queries, `storage.ts` handles file uploads, `types.ts` defines domain types.

### Key domain types

- `Collection` — a group of songs with a color theme and role-based access (`admin`, `editor`, `viewer`).
- `Song` — belongs to a collection; has `audio_tracks` and `lyrics` (JSON stanzas with timestamps).
- `LyricStanza` — array of verses (or multicolumn verse arrays), each with optional `start_time`/`end_time` and `color_keys`.

## Conventions

- All UI text is in Spanish.
- Use `@/` import aliases, not relative paths.
- Use DaisyUI components and Tailwind utilities, not raw HTML/hardcoded colors.
- Use `lucide-vue-next` for icons.
- Composables follow the `useXxx` naming convention and live in `src/composables/`.
- Lyrics JSON structure is defined in `src/data/lyric-schema.json`.

## Testing

Vitest + `@vue/test-utils` + happy-dom. Tests are **co-located** with source files (e.g. `src/utils/color-utils.test.ts`). Shared fixtures live in `src/__fixtures__/`.

When fixing a bug, add a regression test if the affected logic is testable. Prefer testing the pure function or extracted logic over mocking heavy framework deps.

## Database

Supabase (Postgres). Migrations live in `supabase/migrations/`. Auth uses Supabase Auth with email/password. Storage uses Supabase Storage buckets for audio files and artwork.

Row-Level Security (RLS) controls access — collections can be public or private with per-user roles.

## Deployment

Vercel SPA with catch-all rewrite (`vercel.json`). No server-side rendering — the `server/` directory exists but is currently empty/unused.
