# File storage

Ensayando stores media in private Cloudflare R2 buckets. Supabase remains the source of truth for
database rows and authentication; Vercel Functions authorize access and mint short-lived R2 URLs.
Files never pass through a Vercel Function.

## Buckets

| Environment         | Bucket                  | Location | Access  |
| ------------------- | ----------------------- | -------- | ------- |
| Production          | `ensayando`             | ENAM     | Private |
| Preview/development | `ensayando-dev`         | ENAM     | Private |

Keys are provider-independent database values:

- `audio/<collection-id>/<uuid>.<ext>`
- `artwork/<collection-id>/<uuid>.<ext>`
- `legacy/<provider>/<uuid>.<ext>` for source objects no longer referenced by the database
- `_smoke/<uuid>` and `_contract/<uuid>` for disposable checks

Do not enable `r2.dev`. If permanent public URLs become necessary, use a separate public bucket
with a custom domain.

## Runtime flow

1. The browser requests an upload URL from `/api/storage` using its Supabase access token.
2. The function verifies that the user is a collection admin/editor and signs an exact content
   type for a direct browser-to-R2 PUT.
3. The browser uploads directly to R2 and asks the function to complete the upload.
4. The function performs `HeadObject`; invalid or oversized objects are deleted.
5. Playback requests are authorized through Supabase RLS and receive one-hour presigned GET URLs.

Audio is capped at 100 MiB and artwork at 10 MiB. The S3 client must retain both checksum options
as `WHEN_REQUIRED`; otherwise AWS SDK v3 can add a CRC32 checksum that breaks browser PUTs to R2.

## Environment variables

The Vercel project uses sensitive variables with different values per target:

```text
R2_ACCOUNT_ID
R2_BUCKET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

The API also reads `SUPABASE_URL`/`SUPABASE_ANON_KEY`, falling back to the existing
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` values. `/api/members` requires
`SUPABASE_SERVICE_ROLE_KEY` (see [Permissions](permissions.md)). Migration scripts additionally
require `BLOB_READ_WRITE_TOKEN`; `SUPABASE_STORAGE_BUCKET` defaults to `audio-files`.

Use one Cloudflare Object Read & Write token per bucket. Never reuse Ticket Say credentials or
commit credentials to the repository.

## Verification

Run normal checks without cloud credentials:

```bash
pnpm type-check
pnpm lint
pnpm test
```

The following are opt-in and write only disposable prefixes:

```bash
pnpm test:storage                 # dev bucket contract
R2_BROWSER_TEST=1 pnpm test:e2e tests/e2e/r2-cors.spec.ts
pnpm storage:smoke                # _smoke probe, then delete
```

## Production migration record

The production copy completed on 2026-09-28:

| Store/prefix                  | Objects | Bytes         |
| ----------------------------- | ------: | ------------: |
| Supabase Storage source       |     264 |   985,801,234 |
| Vercel Blob source            |     142 |   287,988,728 |
| R2 `audio/`                   |     369 | 1,180,931,097 |
| R2 `artwork/`                 |       1 |       196,355 |
| R2 `legacy/vercel-blob/`      |      36 |    92,662,510 |
| **R2 total**                  | **406** | **1,273,789,962** |

All 369 audio rows and the one artwork row have R2 keys; no referenced row remains pending. Every
object passed an independent source/R2 size comparison and ten distributed samples passed SHA-256
comparison. Production playback was then verified through presigned R2 URLs.

Following explicit owner approval on 2026-09-28, all 264 Supabase Storage objects (985,801,234
bytes) and all 142 Vercel Blob objects (287,988,728 bytes) were deleted through their storage APIs.
Both sources report zero objects and zero bytes. R2 still reports the expected 406 objects and
1,273,789,962 bytes, and production playback was rechecked after source deletion.

On 2026-09-30, migration `20260930135033_remove_legacy_migration_data.sql` removed the one-shot
copy RPC and color backup, cleared the migrated `audio_file_url` values, and removed
`artwork_file_url`. External audio URLs remain supported for tracks without an R2 key, enforced by
the `audio_tracks_exactly_one_audio_source` constraint.
