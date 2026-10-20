# Stage 1: collection parts

Migration: `20261020121649_collection_parts.sql`. No solo/autoplay behavior is introduced.
Applied to production on 2026-10-20 after reviewing the schema and rehearsing locally.

## Stored contract

- `collection_parts`: UUID `id`, bigint `collection_id`, nonblank `name` (1–80 trimmed
  characters), existing palette `color_key`, nullable same-collection `parent_id`,
  integer `order`. Parent cycles are rejected. No inheritance is inferred or applied.
  Read access follows the collections table's RLS; only collection admins can write.
- Tracks: `kind` is `voice | instrumental | unclassified` (default unclassified),
  `part_ids uuid[]` defaults empty, `parts_reviewed` defaults false. Instrumental
  tracks cannot associate parts. Unclassified tracks can carry provisional mappings.
  Every part must belong to the song's collection. Chosen `color_key` is independent
  of mappings; a shared Solistas track keeps its chosen principal-soloist color.
- Verses: `part_ids` is a UUID array in presentation order. `audio_override` and
  `color_override` are optional booleans. `true` preserves the corresponding legacy
  materialized field exactly, including an explicit empty audio list. Otherwise
  colors come from parts in selection order; audio is the distinct matching song
  tracks, ordered by ID. No matching track means **absent** `audio_track_ids`, not `[]`.
  No `part_ids` means legacy behavior; same-song audio validation still applies.
- Saves reject foreign/nonexistent parts and tracks, even in explicit exceptions.
  Text, timestamps, stanza/column structure, and unrelated fields are not rewritten.
  Tracks cannot move songs, parts cannot move collections, and songs cannot move
  collections (such moves would invalidate ownership of their children).

## Backfill safety

Only palette keys actually used in lyric `color_keys` become provisional parts.
Pure track colors are excluded. Names use palette name, then an unambiguous track
title for that color, then the palette key. UUIDs are the deterministic MD5 UUID of
`ensayando:parts:v1:<collection_id>:<key>`; `(collection_id,migration_origin_key)` is
unique. Origin keys stay unchanged when palette keys are renamed. The migration is
applied once; its backfill insertion is conflict-safe, not the entire DDL migration.

Existing nested arrays and every old verse field remain unchanged. Matched part IDs
follow old color order; both overrides are true. Uncolored verses are unchanged.
Track suggestions union parts only from verses whose audio array is exactly that
single track. Multitrack verses never produce a cross-product suggestion. All track
kinds remain unclassified and all suggestions remain unreviewed. No names or colors
are used to infer track mappings or hierarchy.

## Writes and resynchronization

Songs and tracks use ordinary table writes. Collection settings can call
`update_collection_music(bigint,integer,text,jsonb,jsonb,jsonb)` to save the palette,
key remaps, and complete parts list in one admin-only transaction. A rejected part
edit rolls back the palette and all dependent lyrics/track updates too.
`update_collection_parts(p_collection_id bigint, p_parts jsonb)`: an admin-only atomic
replacement of the collection's complete list, each item containing `id`, `name`,
`color_key`, `parent_id`, and `order`. UUIDs are supplied by the client. Parents may
appear later in the payload. Duplicate IDs, foreign IDs, invalid parents, and omitted
referenced parts reject the whole transaction. Omitted unreferenced parts are deleted.
Existing migration origin keys are retained. Direct admin table writes also work.
New verse part selections should submit both override flags false and let the database materialize fields.
`normalize_part_lyrics(jsonb,jsonb,bigint,bigint,boolean)` recursively normalizes
arrays and validates leaf verses. It is internal, not callable by clients.
`parts_guard()` validates ownership and parents; `resync_part_lyrics()` updates
non-overridden materialized fields after part color / track mapping changes.

For an unchanged part selection, an edit of a materialized field conservatively
sets its override true, even if an old client carried forward a false flag. To
rejoin canonical mapping, clear a previously true override to false, or keep the
materialized field unchanged while clearing flags. Do not submit stale materialized
fields alongside an unchanged selection expecting them to be ignored. This is
conservative conflict handling, not full optimistic concurrency/version control.

`prevent_part_dangling()` blocks referenced part/track deletion with `PART_IN_USE`
or `TRACK_IN_USE` and a reassignment instruction. Parent references also count.
Song/collection cascades are allowed. Mutation guards lock the collection row to
serialize role/reference edits; applications should retry transaction deadlocks.

`update_collection_palette(bigint,integer,text,jsonb,jsonb)` keeps its existing
signature and admin permission. It atomically remaps tracks, parts, and lyrics;
unmapped referenced part colors produce `KEY_IN_USE`, rolling back everything.
Part remaps precede verse remaps so canonical verses remain canonical. A deferred
`check_part_palette()` constraint also rejects direct palette writes that orphan parts.
All security-definer helpers use an empty search path and are not client-executable.

## Local regression checks

With a running **local** Supabase and this migration applied, export local keys as
`SUPABASE_TEST_ANON_KEY` and `SUPABASE_TEST_SERVICE_ROLE_KEY`, then run
`SUPABASE_DB_TEST=1 pnpm exec vitest run tests/db/parts.test.ts tests/db/palette.test.ts`.
The new suite refuses non-loopback endpoints and tests RLS, foreign IDs, hierarchy,
grouped audio, no-recording roles, exceptions, resync, old-client edits, chosen track
colors, referenced deletion, cascades, and palette remapping. It creates isolated
fixtures and cleans them up; ordinary unit runs skip it. The one-time backfill must
also be rehearsed against pre-migration fixtures/a local database snapshot.

## Rollout order

Production rollout is a separate, explicitly approved action. Back up collections,
tracks and lyrics first, then apply the database migration **before** publishing the
frontend, whose collection queries embed the new table. Existing clients continue
to use materialized colors/audio associations. Do not remove the legacy fields.

After migration, review the provisional part names and each track's contained parts;
classify vocal/instrumental tracks explicitly. Never infer the display color of a
shared track from its contents. Choosing parts in the verse editor opts that verse
into derived assignments; imported overrides remain intact until explicitly changed.

The local rehearsal applied all migrations through the previous schema, inserted
nested-column fixtures with single-track, ambiguous multitrack, and missing-audio
assignments, then applied this migration. Removing only the three new verse fields
reproduced the original JSON exactly. The shared track kept its chosen color,
ambiguous multitrack verses produced no suggestions, and all imported track mappings
remained unreviewed and unclassified. This is a synthetic rehearsal, not a full
production-snapshot restore.

## Production verification (2026-10-20)

The preflight found no foreign-song audio references, unknown lyric colors, or
existing stage-one fields. The migration created 60 provisional parts across the
6 collections. All 67 songs, 379 tracks, and 3373 lyric fragments remain present.
An independent recursive comparison against the private backup found **zero**
differences in the full legacy lyrics JSON, existing track fields, and palettes.
All 379 tracks remain unclassified/unreviewed; musical decisions were not guessed.

Recovery snapshots are retained in `migration_backups.parts_stage1_collections`,
`parts_stage1_tracks`, and `parts_stage1_lyrics`. Neither `anon` nor `authenticated`
has schema access. The migration locks writes while snapshotting/backfilling and
asserts legacy preservation before commit. Retain these backups until their
removal is separately approved. This migration is additive; reverting the frontend
does not require discarding parts or restoring lyrics.
