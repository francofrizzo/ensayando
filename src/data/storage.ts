import type { AudioTrack, Collection } from "@/data/types";
import { supabase } from "@/lib/supabaseClient";

export type UploadResult = {
  key: string;
  url: string;
  filename: string;
  size: number;
};

type StorageAction = Record<string, unknown> & { action: string };

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/x-m4a",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav"
};

async function storageRequest<T>(body: StorageAction): Promise<T> {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const response = await fetch("/api/storage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Error de almacenamiento (${response.status})`);
  }

  return (response.status === 204 ? undefined : await response.json()) as T;
}

function contentTypeForAudio(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/** Fraction of the file sent, 0 to 1. */
export type UploadProgress = (fraction: number) => void;

export async function uploadAudioFile(
  file: File,
  collectionId: number,
  onProgress?: UploadProgress
): Promise<UploadResult> {
  return await uploadFile(file, collectionId, "audio", contentTypeForAudio(file), onProgress);
}

// Collection artwork: only the collection's admins may upload it (api/storage.ts).
export async function uploadArtworkFile(file: File, collectionId: number): Promise<UploadResult> {
  return await uploadFile(file, collectionId, "artwork", file.type || "image/jpeg");
}

export async function deleteArtworkFile(key: string): Promise<void> {
  await storageRequest<void>({ action: "delete", fileType: "artwork", key });
}

// fetch() can't report upload progress; XMLHttpRequest can.
function putWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: UploadProgress
): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error("Se cortó la conexión mientras subía el audio"));
    xhr.send(file);
  });
}

async function uploadFile(
  file: File,
  collectionId: number,
  fileType: "audio" | "artwork",
  contentType: string,
  onProgress?: UploadProgress
): Promise<UploadResult> {
  const signed = await storageRequest<{
    key: string;
    url: string;
    headers: Record<string, string>;
  }>({
    action: "sign-upload",
    fileType,
    collectionId,
    filename: file.name,
    contentType,
    size: file.size
  });

  const status = onProgress
    ? await putWithProgress(signed.url, signed.headers, file, onProgress)
    : (await fetch(signed.url, { method: "PUT", headers: signed.headers, body: file })).status;
  if (status < 200 || status >= 300) {
    throw new Error(`R2 rechazó la carga (${status})`);
  }

  const completed = await storageRequest<{ url: string; size: number }>({
    action: "complete-upload",
    fileType,
    key: signed.key
  });

  return {
    key: signed.key,
    url: completed.url,
    filename: file.name,
    size: completed.size
  };
}

export async function resolveAudioTrackUrls(tracks: AudioTrack[]): Promise<AudioTrack[]> {
  const r2Tracks = tracks.filter((track) => track.audio_file_key);
  if (r2Tracks.length === 0) return tracks;

  const urls: Record<string, string> = {};
  for (let index = 0; index < r2Tracks.length; index += 100) {
    const batch = r2Tracks.slice(index, index + 100);
    const result = await storageRequest<{ urls: Record<string, string> }>({
      action: "download-audio",
      trackIds: batch.map((track) => track.id)
    });
    Object.assign(urls, result.urls);
  }

  return tracks.map((track) => ({
    ...track,
    playback_url: urls[String(track.id)] ?? track.audio_file_url
  }));
}

export async function resolveCollectionArtwork(collection: Collection): Promise<Collection> {
  if (!collection.artwork_file_key) return collection;
  const { url } = await storageRequest<{ url: string }>({
    action: "download-artwork",
    collectionId: collection.id
  });
  return { ...collection, artwork_playback_url: url };
}

export function audioPlaybackUrl(track: AudioTrack): string {
  return track.playback_url || track.audio_file_url;
}

export function artworkPlaybackUrl(collection: Collection): string {
  return collection.artwork_playback_url || "";
}

export async function deleteAudioFile(key: string): Promise<void> {
  await storageRequest<void>({ action: "delete", fileType: "audio", key });
}
