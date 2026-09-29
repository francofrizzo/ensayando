// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { deleteCollection, deleteSong, parseContentRequest } from "../../server/admin/content";
import { databaseError, postHandler } from "../../server/http";

const AUDIO_7 = "audio/7/9d2f1c61-a8bf-4a42-a456-807a2b785abc.mp3";
const AUDIO_7_B = "audio/7/1d2f1c61-a8bf-4a42-a456-807a2b785abc.ogg";
const AUDIO_8 = "audio/8/2d2f1c61-a8bf-4a42-a456-807a2b785abc.mp3";
const ARTWORK_7 = "artwork/7/3d2f1c61-a8bf-4a42-a456-807a2b785abc.jpg";

// Minimal stand-in for the query builder: select(...).eq(...).maybeSingle() and
// delete().eq(...).select(...).
function client(row: unknown, deleted: unknown[] | null, error: { message: string } | null = null) {
  return {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error }) }) }),
      delete: () => ({ eq: () => ({ select: async () => ({ data: deleted, error: null }) }) })
    }))
  } as unknown as SupabaseClient;
}

describe("content request parsing", () => {
  it("accepts the two deletions and rejects anything else", () => {
    expect(parseContentRequest({ action: "delete-song", songId: 4 })).toEqual({
      action: "delete-song",
      songId: 4
    });
    expect(() => parseContentRequest({ action: "delete-song", songId: "4" })).toThrow("Canción inválida");
    expect(() => parseContentRequest({ action: "delete-collection", collectionId: 0 })).toThrow(
      "Colección inválida"
    );
    expect(() => parseContentRequest({ action: "truncate" })).toThrow("Acción inválida");
  });
});

describe("deleteSong", () => {
  it("deletes the row, then only the audio that belongs to its collection", async () => {
    const remove = vi.fn(async () => undefined);
    const song = {
      id: 4,
      collection_id: 7,
      audio_tracks: [{ audio_file_key: AUDIO_7 }, { audio_file_key: null }, { audio_file_key: AUDIO_8 }]
    };
    await expect(deleteSong(client(song, [{ id: 4 }]), 4, remove)).resolves.toEqual({ orphanedKeys: [] });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(AUDIO_7);
  });

  it("reports objects R2 couldn't delete without failing", async () => {
    const remove = vi.fn(async (key: string) => {
      if (key === AUDIO_7_B) throw new Error("R2 down");
    });
    const song = { id: 4, collection_id: 7, audio_tracks: [{ audio_file_key: AUDIO_7 }, { audio_file_key: AUDIO_7_B }] };
    await expect(deleteSong(client(song, [{ id: 4 }]), 4, remove)).resolves.toEqual({
      orphanedKeys: [AUDIO_7_B]
    });
  });

  it("is forbidden when RLS deletes nothing, and leaves R2 alone", async () => {
    const remove = vi.fn(async () => undefined);
    const song = { id: 4, collection_id: 7, audio_tracks: [{ audio_file_key: AUDIO_7 }] };
    await expect(deleteSong(client(song, []), 4, remove)).rejects.toMatchObject({ status: 403 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("is not found when the song isn't readable", async () => {
    await expect(deleteSong(client(null, null), 4)).rejects.toMatchObject({ status: 404 });
  });
});

describe("deleteCollection", () => {
  it("removes every audio file and the artwork", async () => {
    const remove = vi.fn(async () => undefined);
    const collection = {
      id: 7,
      artwork_file_key: ARTWORK_7,
      songs: [{ audio_tracks: [{ audio_file_key: AUDIO_7 }] }, { audio_tracks: [{ audio_file_key: AUDIO_7_B }] }]
    };
    await deleteCollection(client(collection, [{ id: 7 }]), 7, remove);
    expect(remove.mock.calls.map(([key]) => key).sort()).toEqual([ARTWORK_7, AUDIO_7_B, AUDIO_7].sort());
  });
});

describe("database errors and handler", () => {
  it("translates RPC codes to Spanish messages", () => {
    expect(databaseError({ message: "LAST_ADMIN" })).toMatchObject({
      status: 409,
      message: "La colección tiene que tener al menos un admin."
    });
    expect(databaseError({ message: "relation does not exist" })).toMatchObject({ status: 500 });
  });

  it("answers 405, 401 and ApiError statuses as JSON", async () => {
    const handler = postHandler("Test", async () => {
      throw databaseError({ message: "FORBIDDEN" });
    });
    const res = { code: 0, body: undefined as unknown, headers: {} as Record<string, string> };
    const response = {
      setHeader: (name: string, value: string) => void (res.headers[name] = value),
      status(code: number) {
        res.code = code;
        return response;
      },
      json: (body: unknown) => void (res.body = body),
      end: () => undefined
    };
    await handler({ method: "GET", headers: {}, body: {} }, response);
    expect(res.code).toBe(405);
    await handler({ method: "POST", headers: {}, body: {} }, response);
    expect(res).toMatchObject({ code: 403, body: { error: "No tenés permiso para hacer esto." } });
  });
});
