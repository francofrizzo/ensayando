import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;

const AUDIO_CONTENT_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
  "audio/x-wav"
]);

const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "ogg", "wav"]);
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;

export type StorageFileType = "audio" | "artwork";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  bucket: string;
};

let cachedClient: S3Client | null = null;
let cachedConfig: R2Config | null = null;

export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const sessionToken = process.env.R2_SESSION_TOKEN;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET");
  }

  return { accountId, accessKeyId, secretAccessKey, sessionToken, bucket };
}

export function getR2Client(config = getR2Config()): S3Client {
  if (
    !cachedClient ||
    !cachedConfig ||
    cachedConfig.accountId !== config.accountId ||
    cachedConfig.accessKeyId !== config.accessKeyId ||
    cachedConfig.secretAccessKey !== config.secretAccessKey ||
    cachedConfig.sessionToken !== config.sessionToken ||
    cachedConfig.bucket !== config.bucket
  ) {
    cachedConfig = config;
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED"
    });
  }

  return cachedClient;
}

export function validateUpload(fileType: StorageFileType, contentType: string, size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("El archivo está vacío o tiene un tamaño inválido");
  }

  if (fileType === "audio") {
    if (!AUDIO_CONTENT_TYPES.has(contentType)) {
      throw new Error("Tipo de archivo de audio no permitido");
    }
    if (size > MAX_AUDIO_BYTES) {
      throw new Error("El archivo de audio supera el límite de 100 MB");
    }
    return;
  }

  if (!contentType.startsWith("image/")) {
    throw new Error("Tipo de imagen no permitido");
  }
  if (size > MAX_ARTWORK_BYTES) {
    throw new Error("La imagen supera el límite de 10 MB");
  }
}

export function extensionForUpload(fileType: StorageFileType, filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (fileType === "audio" && AUDIO_EXTENSIONS.has(extension)) return extension;
  if (fileType === "artwork" && /^[a-z0-9]{1,8}$/.test(extension)) return extension;
  return fileType === "audio" ? "mp3" : "jpg";
}

export function createObjectKey(
  fileType: StorageFileType,
  collectionId: number,
  filename: string
): string {
  if (!Number.isSafeInteger(collectionId) || collectionId <= 0) {
    throw new Error("Colección inválida");
  }
  const prefix = fileType === "audio" ? "audio" : "artwork";
  return `${prefix}/${collectionId}/${randomUUID()}.${extensionForUpload(fileType, filename)}`;
}

export function collectionIdFromKey(key: string, fileType: StorageFileType): number | null {
  const prefix = fileType === "audio" ? "audio" : "artwork";
  const match = key.match(new RegExp(`^${prefix}/([1-9]\\d*)/[a-f0-9-]+\\.[a-z0-9]+$`, "i"));
  if (!match?.[1]) return null;
  const collectionId = Number(match[1]);
  return Number.isSafeInteger(collectionId) ? collectionId : null;
}

function contentDisposition(filename: string): string {
  const fallback =
    filename
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\]/g, "_") || "file";
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function createUploadUrl(input: {
  key: string;
  contentType: string;
  filename: string;
}): Promise<{ url: string; headers: Record<string, string> }> {
  const config = getR2Config();
  const disposition = contentDisposition(input.filename);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentDisposition: disposition,
    CacheControl: "private, max-age=3600"
  });

  return {
    url: await getSignedUrl(getR2Client(config), command, { expiresIn: UPLOAD_URL_TTL_SECONDS }),
    headers: {
      "Content-Type": input.contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=3600"
    }
  };
}

export async function createDownloadUrl(key: string): Promise<string> {
  const config = getR2Config();
  return await getSignedUrl(
    getR2Client(config),
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
  );
}

export async function createExistingDownloadUrl(key: string): Promise<string | null> {
  const config = getR2Config();
  try {
    await getR2Client(config).send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
  return await createDownloadUrl(key);
}

export async function verifyUploadedObject(input: {
  key: string;
  fileType: StorageFileType;
}): Promise<{ size: number; contentType: string }> {
  const config = getR2Config();
  const client = getR2Client(config);
  const object = await client.send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: input.key })
  );
  const size = object.ContentLength ?? 0;
  const contentType = object.ContentType ?? "";

  try {
    validateUpload(input.fileType, contentType, size);
  } catch (error) {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: input.key }));
    throw error;
  }

  return { size, contentType };
}

export async function deleteObject(key: string): Promise<void> {
  const config = getR2Config();
  await getR2Client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
