import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { list as listBlobs } from "@vercel/blob";
import { createHash } from "node:crypto";

import { getR2Client, getR2Config } from "../server/storage/r2";

type AudioSource = {
  id: number;
  audio_file_url: string;
  audio_file_key: string | null;
  songs: { collection_id: number } | { collection_id: number }[];
};

type ArtworkSource = {
  id: number;
  artwork_file_url: string;
  artwork_file_key: string | null;
};

type MigrationItem = {
  type: "audio" | "artwork" | "legacy";
  label: string;
  databaseId?: number;
  sourceUrl: string;
  objectKey: string;
  pending: boolean;
};

type SourceObject = {
  provider: "supabase" | "vercel-blob";
  sourceUrl: string;
  sourceKey: string;
  size: number;
};

const execute = process.argv.includes("--execute");
const verify = process.argv.includes("--verify");

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function extensionFromUrl(url: string, fallback: string): string {
  const pathname = new URL(url).pathname;
  return pathname.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() ?? fallback;
}

function deterministicUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function filenameFromUrl(url: string): string {
  const encoded = new URL(url).pathname.split("/").pop() || "file";
  try {
    return decodeURIComponent(encoded).replace(/["\\\r\n]/g, "_");
  } catch {
    return encoded.replace(/["\\\r\n]/g, "_");
  }
}

function sourceProvider(url: string): string {
  const host = new URL(url).hostname;
  if (host.endsWith("supabase.co")) return "supabase";
  if (host.endsWith("public.blob.vercel-storage.com")) return "vercel-blob";
  return host;
}

function canonicalUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString();
}

function adminSupabase() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function loadItems(): Promise<{
  items: MigrationItem[];
  audioRows: AudioSource[];
  artworkRows: ArtworkSource[];
}> {
  const supabase = adminSupabase();
  const [audioResult, artworkResult] = await Promise.all([
    supabase
      .from("audio_tracks")
      .select("id,audio_file_url,audio_file_key,songs!inner(collection_id)")
      .neq("audio_file_url", ""),
    supabase
      .from("collections")
      .select("id,artwork_file_url,artwork_file_key")
      .not("artwork_file_url", "is", null)
  ]);
  if (audioResult.error) throw audioResult.error;
  if (artworkResult.error) throw artworkResult.error;

  const audioRows = audioResult.data as unknown as AudioSource[];
  const artworkRows = artworkResult.data as unknown as ArtworkSource[];
  const items: MigrationItem[] = [];

  for (const row of audioRows) {
    const song = Array.isArray(row.songs) ? row.songs[0] : row.songs;
    if (!song) throw new Error(`Track ${row.id} has no song collection`);
    const extension = extensionFromUrl(row.audio_file_url, "mp3");
    items.push({
      type: "audio",
      label: `audio track ${row.id}`,
      databaseId: row.id,
      sourceUrl: row.audio_file_url,
      objectKey:
        row.audio_file_key ??
        `audio/${song.collection_id}/${deterministicUuid(`audio:${row.id}`)}.${extension}`,
      pending: row.audio_file_key === null
    });
  }

  for (const row of artworkRows) {
    if (!row.artwork_file_url) continue;
    const extension = extensionFromUrl(row.artwork_file_url, "jpg");
    items.push({
      type: "artwork",
      label: `collection artwork ${row.id}`,
      databaseId: row.id,
      sourceUrl: row.artwork_file_url,
      objectKey:
        row.artwork_file_key ??
        `artwork/${row.id}/${deterministicUuid(`artwork:${row.id}`)}.${extension}`,
      pending: row.artwork_file_key === null
    });
  }

  return { items, audioRows, artworkRows };
}

async function listSupabaseObjects(): Promise<SourceObject[]> {
  const supabase = adminSupabase();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "audio-files";
  const objects: SourceObject[] = [];

  async function visit(prefix: string): Promise<void> {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" }
      });
      if (error) throw error;

      for (const entry of data) {
        const sourceKey = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!entry.id) {
          await visit(sourceKey);
          continue;
        }
        const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(sourceKey);
        objects.push({
          provider: "supabase",
          sourceUrl: publicUrl.publicUrl,
          sourceKey,
          size: Number(entry.metadata?.size ?? 0)
        });
      }

      if (data.length < 1000) break;
    }
  }

  await visit("");
  return objects;
}

async function listVercelObjects(): Promise<SourceObject[]> {
  const token = requiredEnv("BLOB_READ_WRITE_TOKEN");
  const objects: SourceObject[] = [];
  let cursor: string | undefined;

  do {
    const page = await listBlobs({ token, cursor, limit: 1000 });
    objects.push(
      ...page.blobs.map((blob) => ({
        provider: "vercel-blob" as const,
        sourceUrl: blob.url,
        sourceKey: blob.pathname,
        size: blob.size
      }))
    );
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return objects;
}

async function includeUnreferencedObjects(items: MigrationItem[]): Promise<{
  items: MigrationItem[];
  inventory: Record<string, { objects: number; bytes: number; unreferenced: number }>;
}> {
  const sourceObjects = [...(await listSupabaseObjects()), ...(await listVercelObjects())];
  const referencedUrls = new Set(items.map((item) => canonicalUrl(item.sourceUrl)));
  const inventory: Record<string, { objects: number; bytes: number; unreferenced: number }> = {};

  for (const source of sourceObjects) {
    const summary = (inventory[source.provider] ??= { objects: 0, bytes: 0, unreferenced: 0 });
    summary.objects += 1;
    summary.bytes += source.size;
    if (referencedUrls.has(canonicalUrl(source.sourceUrl))) continue;

    summary.unreferenced += 1;
    const extension = extensionFromUrl(source.sourceUrl, "bin");
    items.push({
      type: "legacy",
      label: `${source.provider} ${source.sourceKey}`,
      sourceUrl: source.sourceUrl,
      objectKey: `legacy/${source.provider}/${deterministicUuid(`${source.provider}:${source.sourceKey}`)}.${extension}`,
      pending: true
    });
  }

  return { items, inventory };
}

async function bodyBytes(body: { transformToByteArray(): Promise<Uint8Array> }) {
  return new Uint8Array(await body.transformToByteArray());
}

async function copyItem(client: S3Client, bucket: string, item: MigrationItem): Promise<number> {
  const source = await fetch(item.sourceUrl);
  if (!source.ok) throw new Error(`Source returned ${source.status} for ${item.label}`);
  const bytes = new Uint8Array(await source.arrayBuffer());
  const contentType =
    source.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  const contentDisposition =
    source.headers.get("content-disposition") ||
    `inline; filename="${filenameFromUrl(item.sourceUrl)}"`;

  try {
    const existing = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: item.objectKey })
    );
    if (existing.ContentLength !== bytes.byteLength) {
      throw new Error(`Existing object size mismatch for ${item.objectKey}`);
    }
    console.log(
      JSON.stringify({ status: "skipped", key: item.objectKey, bytes: bytes.byteLength })
    );
    return bytes.byteLength;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 404) throw error;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: item.objectKey,
      Body: bytes,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
      CacheControl: "private, max-age=3600"
    })
  );
  console.log(JSON.stringify({ status: "copied", key: item.objectKey, bytes: bytes.byteLength }));
  return bytes.byteLength;
}

async function applyKeys(items: MigrationItem[]): Promise<void> {
  const supabase = adminSupabase();
  const audioUpdates = items
    .filter((item) => item.type === "audio" && item.databaseId !== undefined)
    .map((item) => ({
      id: item.databaseId,
      source_url: item.sourceUrl,
      object_key: item.objectKey
    }));
  const artworkUpdates = items
    .filter((item) => item.type === "artwork" && item.databaseId !== undefined)
    .map((item) => ({
      id: item.databaseId,
      source_url: item.sourceUrl,
      object_key: item.objectKey
    }));
  const { data, error } = await supabase.rpc("apply_storage_key_migration", {
    audio_updates: audioUpdates,
    artwork_updates: artworkUpdates
  });
  if (error) throw error;
  console.log(JSON.stringify({ status: "database-updated", result: data }));
}

async function verifyItems(
  client: S3Client,
  bucket: string,
  items: MigrationItem[]
): Promise<void> {
  let sourceBytes = 0;
  let r2Bytes = 0;
  for (const item of items) {
    const [source, target] = await Promise.all([
      fetch(item.sourceUrl, { method: "HEAD" }),
      client.send(new HeadObjectCommand({ Bucket: bucket, Key: item.objectKey }))
    ]);
    if (!source.ok)
      throw new Error(`Source HEAD returned ${source.status} for ${item.label}`);
    const sourceSize = Number(source.headers.get("content-length"));
    const targetSize = target.ContentLength ?? 0;
    if (sourceSize !== targetSize) throw new Error(`Size mismatch for ${item.objectKey}`);
    sourceBytes += sourceSize;
    r2Bytes += targetSize;
  }

  const samples = items
    .filter((_, index) => index % Math.max(1, Math.floor(items.length / 10)) === 0)
    .slice(0, 10);
  for (const item of samples) {
    const [source, target] = await Promise.all([
      fetch(item.sourceUrl),
      client.send(new GetObjectCommand({ Bucket: bucket, Key: item.objectKey }))
    ]);
    if (!source.ok || !target.Body) throw new Error(`Could not hash ${item.objectKey}`);
    const [sourceData, targetData] = await Promise.all([
      source.arrayBuffer().then((value) => new Uint8Array(value)),
      bodyBytes(target.Body)
    ]);
    const sourceHash = createHash("sha256").update(sourceData).digest("hex");
    const targetHash = createHash("sha256").update(targetData).digest("hex");
    if (sourceHash !== targetHash) throw new Error(`Hash mismatch for ${item.objectKey}`);
  }

  console.log(
    JSON.stringify({
      status: "verified",
      objectCount: items.length,
      sourceBytes,
      r2Bytes,
      hashSamples: samples.length
    })
  );
}

async function main(): Promise<void> {
  const loaded = await loadItems();
  const { items, inventory } = await includeUnreferencedObjects(loaded.items);
  const pendingItems = items.filter((item) => item.pending);
  const counts = new Map<string, number>();
  for (const item of pendingItems) {
    const key = `${item.type}:${sourceProvider(item.sourceUrl)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log(
    JSON.stringify({
      mode: execute ? "execute" : verify ? "verify" : "dry-run",
      totalObjects: verify ? items.length : pendingItems.length,
      sourceInventory: inventory,
      counts: Object.fromEntries(counts)
    })
  );

  if (!execute && !verify) return;
  const config = getR2Config();
  const client = getR2Client(config);
  if (verify) {
    await verifyItems(client, config.bucket, items);
    return;
  }

  let totalBytes = 0;
  for (const item of pendingItems) totalBytes += await copyItem(client, config.bucket, item);
  console.log(
    JSON.stringify({ status: "copy-complete", objectCount: pendingItems.length, totalBytes })
  );
  await verifyItems(client, config.bucket, pendingItems);
  await applyKeys(pendingItems);
}

await main();
