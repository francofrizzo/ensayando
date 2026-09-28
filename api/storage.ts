import type { IncomingHttpHeaders } from "node:http";

import { createRequestSupabaseClient } from "../server/supabase.js";
import {
  collectionIdFromKey,
  createDownloadUrl,
  createExistingDownloadUrl,
  createObjectKey,
  createUploadUrl,
  deleteObject,
  type StorageFileType,
  validateUpload,
  verifyUploadedObject
} from "../server/storage/r2.js";

type VercelRequest = {
  method?: string;
  headers: IncomingHttpHeaders;
  body: unknown;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): void;
  end(): void;
};

type StorageRequest =
  | {
      action: "sign-upload";
      fileType: StorageFileType;
      collectionId: number;
      filename: string;
      contentType: string;
      size: number;
    }
  | { action: "complete-upload"; fileType: StorageFileType; key: string }
  | { action: "download-audio"; trackIds: number[] }
  | { action: "download-artwork"; collectionId: number }
  | { action: "delete"; fileType: StorageFileType; key: string };

function authorizationHeader(req: VercelRequest): string | undefined {
  const value = req.headers.authorization;
  return Array.isArray(value) ? value[0] : value;
}

async function requireEditor(
  authorization: string | undefined,
  collectionId: number
): Promise<void> {
  if (!authorization) throw new Error("AUTH_REQUIRED");
  const supabase = createRequestSupabaseClient(authorization);
  const { data, error } = await supabase
    .from("user_collections")
    .select("role")
    .eq("collection_id", collectionId)
    .in("role", ["admin", "editor"])
    .maybeSingle();

  if (error || !data) throw new Error("FORBIDDEN");
}

function statusForError(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTH_REQUIRED") return 401;
  if (message === "FORBIDDEN") return 403;
  if (message === "NOT_FOUND") return 404;
  return 400;
}

function isFileType(value: unknown): value is StorageFileType {
  return value === "audio" || value === "artwork";
}

function bodyOf(req: VercelRequest): StorageRequest {
  const body: unknown = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!body || typeof body !== "object") throw new Error("Solicitud inválida");

  const value = body as Record<string, unknown>;
  if (value.action === "sign-upload") {
    if (
      !isFileType(value.fileType) ||
      !Number.isSafeInteger(value.collectionId) ||
      typeof value.filename !== "string" ||
      value.filename.length === 0 ||
      value.filename.length > 255 ||
      typeof value.contentType !== "string" ||
      !Number.isSafeInteger(value.size)
    ) {
      throw new Error("Solicitud de carga inválida");
    }
    return value as StorageRequest;
  }

  if (value.action === "complete-upload" || value.action === "delete") {
    if (!isFileType(value.fileType) || typeof value.key !== "string" || !value.key) {
      throw new Error("Solicitud de archivo inválida");
    }
    return value as StorageRequest;
  }

  if (value.action === "download-audio") {
    if (!Array.isArray(value.trackIds) || !value.trackIds.every(Number.isSafeInteger)) {
      throw new Error("Solicitud de audio inválida");
    }
    return value as StorageRequest;
  }

  if (value.action === "download-artwork") {
    if (!Number.isSafeInteger(value.collectionId)) {
      throw new Error("Solicitud de imagen inválida");
    }
    return value as StorageRequest;
  }

  throw new Error("Acción de almacenamiento inválida");
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  try {
    const body = bodyOf(req);
    const authorization = authorizationHeader(req);

    if (body.action === "sign-upload") {
      validateUpload(body.fileType, body.contentType, body.size);
      await requireEditor(authorization, body.collectionId);
      const key = createObjectKey(body.fileType, body.collectionId, body.filename);
      const signed = await createUploadUrl({
        key,
        contentType: body.contentType,
        filename: body.filename
      });
      res.status(200).json({ key, ...signed });
      return;
    }

    if (body.action === "complete-upload" || body.action === "delete") {
      const collectionId = collectionIdFromKey(body.key, body.fileType);
      if (!collectionId) throw new Error("FORBIDDEN");
      await requireEditor(authorization, collectionId);

      if (body.action === "delete") {
        await deleteObject(body.key);
        res.status(204).end();
        return;
      }

      const object = await verifyUploadedObject({ key: body.key, fileType: body.fileType });
      const url = await createDownloadUrl(body.key);
      res.status(200).json({ ...object, url });
      return;
    }

    const supabase = createRequestSupabaseClient(authorization);
    if (body.action === "download-audio") {
      const trackIds = [...new Set(body.trackIds)].filter(Number.isSafeInteger).slice(0, 100);
      if (trackIds.length === 0) {
        res.status(200).json({ urls: {} });
        return;
      }
      const { data, error } = await supabase
        .from("audio_tracks")
        .select("id, audio_file_key")
        .in("id", trackIds)
        .not("audio_file_key", "is", null);
      if (error) throw error;

      const urls = Object.fromEntries(
        (
          await Promise.all(
            (data ?? []).map(async (track) => {
              const url = await createExistingDownloadUrl(track.audio_file_key);
              return url ? ([track.id, url] as const) : null;
            })
          )
        ).filter((entry): entry is readonly [number, string] => entry !== null)
      );
      res.status(200).json({ urls });
      return;
    }

    if (body.action === "download-artwork") {
      const { data, error } = await supabase
        .from("collections")
        .select("artwork_file_key")
        .eq("id", body.collectionId)
        .not("artwork_file_key", "is", null)
        .maybeSingle();
      if (error) throw error;
      if (!data?.artwork_file_key) throw new Error("NOT_FOUND");
      const url = await createExistingDownloadUrl(data.artwork_file_key);
      if (!url) throw new Error("NOT_FOUND");
      res.status(200).json({ url });
      return;
    }

    res.status(400).json({ error: "Acción de almacenamiento inválida" });
  } catch (error) {
    console.error("Storage API error", error);
    res.status(statusForError(error)).json({
      error: error instanceof Error ? error.message : "Error de almacenamiento"
    });
  }
}
