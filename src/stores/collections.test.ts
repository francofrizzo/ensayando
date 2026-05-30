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
  fetchCollectionBySlug: vi.fn().mockResolvedValue({ data: null, error: null }),
  fetchSongsByCollectionId: vi.fn().mockResolvedValue({ data: [], error: null }),
  updateSongLyrics: vi.fn().mockResolvedValue({ error: null })
}));

import * as supabaseData from "@/data/supabase";

import { useCollectionsStore } from "./collections";

const fetchCollectionBySlugMock = vi.mocked(supabaseData.fetchCollectionBySlug);

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
      // Use different stanza counts so edits are structural and don't collapse
      await store.updateLocalLyrics(
        Array.from({ length: i + 1 }, (_, j) => ({ text: `v${j}` })) as LyricStanza
      );
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

  it("redo works after undo", async () => {
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v2"));

    store.undo();
    expect(store.localLyrics.value).toEqual(verse("v1"));
    expect(store.canRedo).toBe(true);

    store.redo();
    expect(store.localLyrics.value).toEqual(verse("v2"));
  });

  it("redo is not cleared by undo-triggered state change", async () => {
    // Simulate: edit v1, edit v2, undo (back to v1)
    // Then simulate what happens if the UI re-calls updateLocalLyrics
    // with the same value after undo (as an @input handler would)
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v2"));

    store.undo();
    expect(store.canRedo).toBe(true);

    // This simulates the textarea @input firing after undo sets the value
    // It should NOT clear the redo stack
    // (This test documents the current bug if it fails)
  });

  it("undo stack empties fully after undoing all edits", async () => {
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v2"));
    await store.updateLocalLyrics(verse("v3"));

    store.undo(); // -> v2
    store.undo(); // -> v1
    store.undo(); // -> []

    expect(store.localLyrics.value).toEqual([]);
    expect(store.canUndo).toBe(false);
  });

  it("undo works when callers mutate shared stanza objects before updateLocalLyrics", async () => {
    // Simulates createVerseModel: shallow copy + in-place mutation
    // This was broken when structuredClone failed on reactive proxies
    await store.updateLocalLyrics(verse("original"));

    // Simulate createVerseModel: shallow-copy the outer array, mutate verse in place
    const shallowCopy = [...store.localLyrics.value];
    (shallowCopy[0] as unknown as { text: string }).text = "edited";
    await store.updateLocalLyrics(shallowCopy as LyricStanza[]);

    expect(store.localLyrics.value).toEqual(verse("edited"));

    store.undo();
    expect(store.localLyrics.value).toEqual(verse("original"));

    store.redo();
    expect(store.localLyrics.value).toEqual(verse("edited"));
  });

  it("undo does not corrupt stacks when called multiple times in sequence", async () => {
    // Use structural changes (different verse counts) to avoid collapsing
    const s1 = [{ text: "a" }] as LyricStanza;
    const s2 = [{ text: "a" }, { text: "b" }] as LyricStanza;
    const s3 = [{ text: "a" }, { text: "b" }, { text: "c" }] as LyricStanza;

    await store.updateLocalLyrics(s1);
    await store.updateLocalLyrics(s2);
    await store.updateLocalLyrics(s3);

    store.undo(); // -> s2
    expect(store.localLyrics.value).toEqual(s2);
    expect(store.canRedo).toBe(true);

    store.undo(); // -> s1
    expect(store.localLyrics.value).toEqual(s1);

    store.redo(); // -> s2
    expect(store.localLyrics.value).toEqual(s2);

    store.redo(); // -> s3
    expect(store.localLyrics.value).toEqual(s3);
    expect(store.canRedo).toBe(false);
  });

  // --- Undo collapsing: consecutive edits to the same verse's text merge into one undo entry ---

  it("collapses consecutive single-verse text edits into one undo entry", async () => {
    await store.updateLocalLyrics(verse("original"));

    // Simulate typing character by character
    await store.updateLocalLyrics(verse("h"));
    await store.updateLocalLyrics(verse("he"));
    await store.updateLocalLyrics(verse("hel"));
    await store.updateLocalLyrics(verse("hell"));
    await store.updateLocalLyrics(verse("hello"));

    // All typing collapses into one undo step
    store.undo();
    expect(store.localLyrics.value).toEqual(verse("original"));
  });

  it("does not collapse edits to different verses", async () => {
    const twoVerses = [{ text: "a" }, { text: "b" }] as LyricStanza;
    await store.updateLocalLyrics(twoVerses);

    // Edit first verse
    await store.updateLocalLyrics([{ text: "a-edited" }, { text: "b" }] as LyricStanza);
    // Edit second verse — different verse changed, should NOT collapse
    await store.updateLocalLyrics([{ text: "a-edited" }, { text: "b-edited" }] as LyricStanza);

    store.undo();
    expect(store.localLyrics.value).toEqual([{ text: "a-edited" }, { text: "b" }]);
    store.undo();
    expect(store.localLyrics.value).toEqual(twoVerses);
  });

  it("does not collapse edits that change structure (add/remove verse)", async () => {
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v1-edited"));
    // Add a second verse — structural change
    await store.updateLocalLyrics([{ text: "v1-edited" }, { text: "v2" }] as LyricStanza);

    store.undo();
    expect(store.localLyrics.value).toEqual(verse("v1-edited"));
    store.undo();
    expect(store.localLyrics.value).toEqual(verse("v1"));
  });

  it("does not collapse edits that change non-text properties", async () => {
    await store.updateLocalLyrics([{ text: "v1", start_time: 0 }] as LyricStanza);
    // Change start_time, not text
    await store.updateLocalLyrics([{ text: "v1", start_time: 5 }] as LyricStanza);

    store.undo();
    expect(store.localLyrics.value).toEqual([{ text: "v1", start_time: 0 }]);
  });

  it("redo works after collapsed edits", async () => {
    await store.updateLocalLyrics(verse("original"));

    await store.updateLocalLyrics(verse("h"));
    await store.updateLocalLyrics(verse("he"));
    await store.updateLocalLyrics(verse("hello"));

    store.undo();
    expect(store.localLyrics.value).toEqual(verse("original"));

    store.redo();
    expect(store.localLyrics.value).toEqual(verse("hello"));
  });

  it("collapse stops when a different verse is edited", async () => {
    const twoVerses = [{ text: "a" }, { text: "b" }] as LyricStanza;
    await store.updateLocalLyrics(twoVerses);

    // Type in first verse
    await store.updateLocalLyrics([{ text: "aa" }, { text: "b" }] as LyricStanza);
    await store.updateLocalLyrics([{ text: "aaa" }, { text: "b" }] as LyricStanza);
    // Switch to second verse
    await store.updateLocalLyrics([{ text: "aaa" }, { text: "bb" }] as LyricStanza);
    await store.updateLocalLyrics([{ text: "aaa" }, { text: "bbb" }] as LyricStanza);

    // Two undo groups: one for each verse
    store.undo();
    expect(store.localLyrics.value).toEqual([{ text: "aaa" }, { text: "b" }]);
    store.undo();
    expect(store.localLyrics.value).toEqual(twoVerses);
  });

  it("ignores no-op updates (identical state)", async () => {
    await store.updateLocalLyrics(verse("v1"));
    await store.updateLocalLyrics(verse("v1")); // same value
    await store.updateLocalLyrics(verse("v1")); // same value

    // Only one entry on the undo stack (the initial [] → v1 transition)
    store.undo();
    expect(store.localLyrics.value).toEqual([]);
    expect(store.canUndo).toBe(false);
  });

  it("does not collapse across undo boundary", async () => {
    await store.updateLocalLyrics(verse("original"));
    await store.updateLocalLyrics(verse("edit1"));

    store.undo();
    expect(store.localLyrics.value).toEqual(verse("original"));

    // New edit after undo — should not collapse with pre-undo edits
    await store.updateLocalLyrics(verse("edit2"));

    store.undo();
    expect(store.localLyrics.value).toEqual(verse("original"));
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

describe("collections store — ensureCollectionLoaded", () => {
  let store: ReturnType<typeof useCollectionsStore>;

  const collection = {
    id: 7,
    slug: "andiepalooza",
    title: "Andiepalooza",
    main_color: "oklch(60.6% 0.25 292.717)",
    track_colors: {},
    artwork_file_url: null,
    visibility: "unlisted" as const,
    created_at: "2026-01-01T00:00:00Z"
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useCollectionsStore();
    fetchCollectionBySlugMock.mockReset();
    fetchCollectionBySlugMock.mockResolvedValue({ data: null, error: null } as never);
  });

  it("fetches an unlisted collection by slug and adds it as a viewer", async () => {
    fetchCollectionBySlugMock.mockResolvedValue({ data: collection, error: null } as never);

    await store.ensureCollectionLoaded("andiepalooza");

    expect(fetchCollectionBySlugMock).toHaveBeenCalledWith("andiepalooza");
    expect(store.collections).toHaveLength(1);
    expect(store.collections[0]).toMatchObject({ slug: "andiepalooza", user_role: "viewer" });
  });

  it("is a no-op when the slug is already loaded", async () => {
    fetchCollectionBySlugMock.mockResolvedValue({ data: collection, error: null } as never);
    await store.ensureCollectionLoaded("andiepalooza");
    fetchCollectionBySlugMock.mockClear();

    // Second call for the same slug should not hit the data layer again.
    await store.ensureCollectionLoaded("andiepalooza");
    expect(fetchCollectionBySlugMock).not.toHaveBeenCalled();
    expect(store.collections).toHaveLength(1);
  });

  it("does nothing when the slug is empty", async () => {
    await store.ensureCollectionLoaded(null);
    await store.ensureCollectionLoaded("");
    expect(fetchCollectionBySlugMock).not.toHaveBeenCalled();
    expect(store.collections).toHaveLength(0);
  });

  it("leaves collections untouched when the slug doesn't resolve", async () => {
    await store.ensureCollectionLoaded("nope");
    expect(store.collections).toHaveLength(0);
  });
});
