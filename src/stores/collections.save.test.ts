import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, reactive } from "vue";

import type { CollectionWithRole, LyricStanza, Song } from "@/data/types";

const route = vi.hoisted(() => ({
  current: null as null | { params: Record<string, string>; query: Record<string, string> }
}));

vi.mock("vue-router", () => ({
  useRoute: () => route.current
}));

vi.mock("@/data/storage", () => ({
  resolveAudioTrackUrls: vi.fn(async (tracks: unknown[]) => tracks),
  resolveCollectionArtwork: vi.fn(async (collection: unknown) => collection)
}));

vi.mock("@/data/supabase", () => ({
  fetchCollections: vi.fn().mockResolvedValue({ data: [], error: null }),
  fetchCollectionBySlug: vi.fn().mockResolvedValue({ data: null, error: null }),
  fetchSongsByCollectionId: vi.fn(),
  updateSongLyrics: vi.fn()
}));

import * as supabaseData from "@/data/supabase";

import { useCollectionsStore } from "./collections";

const fetchSongsMock = vi.mocked(supabaseData.fetchSongsByCollectionId);
const updateLyricsMock = vi.mocked(supabaseData.updateSongLyrics);

const verse = (text: string) => [{ text }] as LyricStanza;

const collection = {
  id: 1,
  slug: "coro",
  title: "Coro",
  hue: 300,
  intensity: "normal",
  track_colors: {},
  visibility: "private",
  user_role: "admin",
  is_member: true
} as unknown as CollectionWithRole;

const makeSong = (overrides: Partial<Song> = {}): Song =>
  ({
    id: 10,
    slug: "vidala",
    collection_id: 1,
    title: "Vidala",
    lyrics: [verse("saved")],
    audio_tracks: [],
    visible: true,
    ...overrides
  }) as unknown as Song;

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

describe("collections store — saving and refreshing", () => {
  let store: ReturnType<typeof useCollectionsStore>;

  beforeEach(async () => {
    vi.clearAllMocks();
    route.current = reactive({ params: { collectionSlug: "coro", songSlug: "vidala" }, query: {} });
    fetchSongsMock.mockResolvedValue({ data: [makeSong()], error: null } as never);
    updateLyricsMock.mockResolvedValue({ error: null } as never);
    setActivePinia(createPinia());
    store = useCollectionsStore();
    store.collections = [collection];
    await flush();
    expect(store.currentSong?.id).toBe(10);
  });

  it("keeps unsaved lyrics when the same song is refreshed", async () => {
    await store.updateLocalLyrics([verse("edited")]);
    await store.fetchSongsByCollectionId(1, { background: true });
    await flush();

    expect(store.localLyrics.value).toEqual([verse("edited")]);
    expect(store.localLyrics.isDirty).toBe(true);
    expect(store.canUndo).toBe(true);
  });

  it("does not flip isLoading on a background refresh", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    fetchSongsMock.mockReturnValueOnce(new Promise((resolve) => (resolveFetch = resolve)) as never);
    const pending = store.fetchSongsByCollectionId(1, { background: true });
    expect(store.isLoading).toBe(false);
    resolveFetch({ data: [makeSong()], error: null });
    await pending;
  });

  it("follows the database copy of a clean song after a refresh", async () => {
    fetchSongsMock.mockResolvedValueOnce({
      data: [makeSong({ lyrics: [verse("from someone else")] })],
      error: null
    } as never);
    await store.fetchSongsByCollectionId(1, { background: true });
    await flush();

    expect(store.localLyrics.value).toEqual([verse("from someone else")]);
    expect(store.localLyrics.isDirty).toBe(false);
  });

  it("saves the snapshot taken before the request and keeps later edits dirty", async () => {
    let resolveSave: (value: unknown) => void = () => {};
    updateLyricsMock.mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)) as never);

    await store.updateLocalLyrics([verse("first")]);
    const saving = store.saveLyrics();
    expect(store.localLyrics.isSaving).toBe(true);
    await store.updateLocalLyrics([verse("typed while saving")]);
    resolveSave({ error: null });
    await saving;

    expect(updateLyricsMock).toHaveBeenCalledWith(10, [verse("first")]);
    expect(store.localLyrics.isSaving).toBe(false);
    expect(store.localLyrics.isDirty).toBe(true);
    expect(store.savedLyrics).toEqual([verse("first")]);
  });

  it("clears isSaving and keeps changes dirty when the save fails", async () => {
    updateLyricsMock.mockResolvedValueOnce({ error: new Error("boom") } as never);
    await store.updateLocalLyrics([verse("edited")]);

    await expect(store.saveLyrics()).rejects.toThrow("boom");
    expect(store.localLyrics.isSaving).toBe(false);
    expect(store.localLyrics.isDirty).toBe(true);
  });

  it("keeps the renamed song resolving under its old address", async () => {
    store.patchSong(10, { slug: "vidala-nueva", title: "Vidala nueva" });
    await flush();
    expect(store.currentSong?.title).toBe("Vidala nueva");

    route.current!.params.songSlug = "vidala-nueva";
    await flush();
    expect(store.currentSong?.id).toBe(10);
  });

  it("undo after discarding doesn't bring back the discarded edits", async () => {
    await store.updateLocalLyrics([verse("discard me")]);
    store.discardLyricsChanges();
    await store.updateLocalLyrics([verse("new edit")]);
    store.undo();

    expect(store.localLyrics.value).toEqual([verse("saved")]);
  });
});
