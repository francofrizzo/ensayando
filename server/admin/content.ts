import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError, databaseError } from "../http.js";
import { collectionIdFromKey, deleteObject } from "../storage/r2.js";

export type ContentRequest =
  | { action: "delete-song"; songId: number }
  | { action: "delete-collection"; collectionId: number };

export type DeletionResult = {
  // R2 objects that could not be removed; they stay as orphans (reported, not fatal).
  orphanedKeys: string[];
};

type DeleteObject = (key: string) => Promise<void>;

export function parseContentRequest(body: Record<string, unknown>): ContentRequest {
  if (body.action === "delete-song") {
    if (!Number.isSafeInteger(body.songId) || (body.songId as number) <= 0) {
      throw new ApiError(400, "Canción inválida");
    }
    return { action: "delete-song", songId: body.songId as number };
  }
  if (body.action === "delete-collection") {
    if (!Number.isSafeInteger(body.collectionId) || (body.collectionId as number) <= 0) {
      throw new ApiError(400, "Colección inválida");
    }
    return { action: "delete-collection", collectionId: body.collectionId as number };
  }
  throw new ApiError(400, "Acción inválida");
}

// Only keys that live under the collection being deleted; anything else is left alone.
function ownedKeys(collectionId: number, keys: (string | null | undefined)[]): string[] {
  return keys.filter(
    (key): key is string =>
      typeof key === "string" &&
      (collectionIdFromKey(key, "audio") === collectionId ||
        collectionIdFromKey(key, "artwork") === collectionId)
  );
}

async function removeObjects(keys: string[], remove: DeleteObject): Promise<string[]> {
  const results = await Promise.allSettled(keys.map((key) => remove(key)));
  const failed = keys.filter((_, index) => results[index]?.status === "rejected");
  if (failed.length > 0) console.error("R2 cleanup left orphaned objects", failed);
  return failed;
}

// Deletes the song through the caller's own client (RLS: collection admins only),
// then its audio in R2. Tracks go with the song (ON DELETE CASCADE).
export async function deleteSong(
  user: SupabaseClient,
  songId: number,
  remove: DeleteObject = deleteObject
): Promise<DeletionResult> {
  const { data: song, error } = await user
    .from("songs")
    .select("id, collection_id, audio_tracks(audio_file_key)")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw databaseError(error);
  if (!song) throw new ApiError(404, "No encontramos esa canción.");

  const keys = ownedKeys(
    song.collection_id,
    (song.audio_tracks ?? []).map((track: { audio_file_key: string | null }) => track.audio_file_key)
  );

  const { data: deleted, error: deleteError } = await user
    .from("songs")
    .delete()
    .eq("id", songId)
    .select("id");
  if (deleteError) throw databaseError(deleteError);
  if (!deleted || deleted.length === 0) {
    throw new ApiError(403, "Solo los admins de la colección pueden eliminar canciones.");
  }

  return { orphanedKeys: await removeObjects(keys, remove) };
}

// Deletes the collection (RLS: its admins), its songs and memberships (cascade), then
// every audio file and the artwork in R2.
export async function deleteCollection(
  user: SupabaseClient,
  collectionId: number,
  remove: DeleteObject = deleteObject
): Promise<DeletionResult> {
  const { data: collection, error } = await user
    .from("collections")
    .select("id, artwork_file_key, songs(audio_tracks(audio_file_key))")
    .eq("id", collectionId)
    .maybeSingle();
  if (error) throw databaseError(error);
  if (!collection) throw new ApiError(404, "No encontramos esa colección.");

  const songs = (collection.songs ?? []) as {
    audio_tracks: { audio_file_key: string | null }[] | null;
  }[];
  const keys = ownedKeys(collectionId, [
    collection.artwork_file_key,
    ...songs.flatMap((song) => (song.audio_tracks ?? []).map((track) => track.audio_file_key))
  ]);

  const { data: deleted, error: deleteError } = await user
    .from("collections")
    .delete()
    .eq("id", collectionId)
    .select("id");
  if (deleteError) throw databaseError(deleteError);
  if (!deleted || deleted.length === 0) {
    throw new ApiError(403, "Solo los admins de la colección pueden eliminarla.");
  }

  return { orphanedKeys: await removeObjects(keys, remove) };
}

export async function handleContentRequest(
  user: SupabaseClient,
  request: ContentRequest,
  remove?: DeleteObject
): Promise<DeletionResult> {
  if (request.action === "delete-song") return await deleteSong(user, request.songId, remove);
  return await deleteCollection(user, request.collectionId, remove);
}
