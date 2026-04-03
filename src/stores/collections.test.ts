import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import type { LyricStanza } from "@/data/types";

// Mock vue-router — the store calls useRoute() at setup time
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: {}, query: {} })
}));

// Mock supabase data layer
vi.mock("@/data/supabase", () => ({
  fetchCollections: vi.fn().mockResolvedValue({ data: [], error: null }),
  fetchSongsByCollectionId: vi.fn().mockResolvedValue({ data: [], error: null }),
  updateSongLyrics: vi.fn().mockResolvedValue({ error: null })
}));

import { useCollectionsStore } from "./collections";

const verse = (text: string) => [{ text }] as LyricStanza;

describe("collections store — undo/redo", () => {
  let store: ReturnType<typeof useCollectionsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useCollectionsStore();
  });

  it("starts with empty undo/redo stacks", () => {
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
  });

  it("pushes to undo stack on updateLocalLyrics", async () => {
    await store.updateLocalLyrics(verse("v1"));
    expect(store.canUndo).toBe(true);
    expect(store.localLyrics.isDirty).toBe(true);
  });

  it("undo restores previous state", async () => {
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v2"));

    expect(store.localLyrics.value).toEqual(verse("v2"));

    store.undo();
    expect(store.localLyrics.value).toEqual(verse("v1"));
    expect(store.canRedo).toBe(true);
  });

  it("redo restores undone state", async () => {
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v2"));

    store.undo();
    expect(store.localLyrics.value).toEqual(verse("v1"));

    store.redo();
    expect(store.localLyrics.value).toEqual(verse("v2"));
  });

  it("new edit clears redo stack", async () => {
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v2"));

    store.undo();
    expect(store.canRedo).toBe(true);

    await store.updateLocalLyrics(verse("v3"));
    expect(store.canRedo).toBe(false);
  });

  it("undo does nothing when stack is empty", () => {
    store.undo();
    expect(store.localLyrics.value).toEqual([]);
  });

  it("redo does nothing when stack is empty", () => {
    store.redo();
    expect(store.localLyrics.value).toEqual([]);
  });

  it("caps undo stack at 50 entries", async () => {
    for (let i = 0; i < 60; i++) {
      await store.updateLocalLyrics(verse(`v${i}`));
    }
    // 60 edits but stack capped at 50
    let undoCount = 0;
    while (store.canUndo) {
      store.undo();
      undoCount++;
    }
    expect(undoCount).toBe(50);
  });

  it("undo during undo does not double-push to undo stack", async () => {
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v2"));
    // undo stack has 2 entries (initial [] and v1)

    store.undo(); // back to v1, redo has v2
    // undo should not have grown — it should have 1 entry (initial [])
    store.undo(); // back to []
    expect(store.localLyrics.value).toEqual([]);
    expect(store.canUndo).toBe(false);
  });

  it("discardLyricsChanges resets to saved snapshot and clears stacks", async () => {
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v2"));

    store.discardLyricsChanges();
    expect(store.localLyrics.value).toEqual([]);
    expect(store.localLyrics.isDirty).toBe(false);
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
  });
});
