import { defineStore } from "pinia";
import { computed, ref, toRaw, watch } from "vue";
import { useRoute } from "vue-router";

import * as supabase from "@/data/supabase";
import type { CollectionWithRole, LyricStanza, Song } from "@/data/types";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";

type UndoSnapshot = {
  lyrics: LyricStanza[];
  focus: FocusPosition | null;
};

export const useCollectionsStore = defineStore("collections", () => {
  // Data state
  const collections = ref<CollectionWithRole[]>([]);
  const songs = ref<Song[]>([]);
  const isLoadingCollections = ref(false);
  const isLoadingSongs = ref(false);
  const songsCollectionId = ref<number | null>(null); // Track which collection the loaded songs belong to

  // Lyrics state
  const localLyrics = {
    value: ref<LyricStanza[]>([]),
    isDirty: ref(false),
    isSaving: ref(false)
  };
  const savedLyricsSnapshot = ref<string>("[]");

  // Undo/redo state
  const MAX_UNDO_STACK = 50;
  const undoStack = ref<UndoSnapshot[]>([]);
  const redoStack = ref<UndoSnapshot[]>([]);
  // Mutable state stored in an object to prevent linter from converting `let` to `const`
  const _undo = {
    lastSnapshot: [] as LyricStanza[],
    lastFocus: null as FocusPosition | null,
    inProgress: false
  };
  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  // Route-reactive computed properties
  const route = useRoute();

  // Role and permissions for the current collection (derived from route)
  const currentUserRole = computed(() => {
    const slug = route.params.collectionSlug as string;
    if (!slug) return null;
    const col = collections.value.find((c) => c.slug === slug);
    return col?.user_role ?? null;
  });

  const canEditCurrentCollection = computed(() => {
    return currentUserRole.value === "admin" || currentUserRole.value === "editor";
  });

  // Filter songs: editors see all, viewers only visible ones
  const visibleSongs = computed(() => {
    if (canEditCurrentCollection.value) return songs.value;
    return songs.value.filter((s) => s.visible !== false);
  });

  const currentCollection = computed(() => {
    const slug = route.params.collectionSlug as string;
    if (!slug) return null;
    return collections.value.find((c) => c.slug === slug) || null;
  });

  const currentSong = computed(() => {
    const slug = route.params.songSlug as string;
    if (!slug) return null;
    return visibleSongs.value.find((s) => s.slug === slug) || null;
  });

  // Auto-fetch songs when collection changes
  watch(
    currentCollection,
    async (collection, previousCollection) => {
      if (collection?.id !== previousCollection?.id) {
        songs.value = [];
        songsCollectionId.value = null;
        localLyrics.value.value = [];
        localLyrics.isDirty.value = false;
      }
      if (collection) {
        await fetchSongsByCollectionId(collection.id);
      }
    },
    { immediate: true }
  );

  // Update local lyrics when song changes
  watch(
    currentSong,
    (song) => {
      if (song) {
        savedLyricsSnapshot.value = JSON.stringify(song.lyrics ?? []);
        localLyrics.value.value = JSON.parse(savedLyricsSnapshot.value);
        localLyrics.isDirty.value = false;
      } else {
        savedLyricsSnapshot.value = "[]";
        localLyrics.value.value = [];
        localLyrics.isDirty.value = false;
      }
      undoStack.value = [];
      redoStack.value = [];
      _undo.lastSnapshot = cloneLyrics(localLyrics.value.value);
      _undo.lastFocus = null;
    },
    { immediate: true }
  );

  // Data fetching methods (no navigation logic)
  async function fetchCollections() {
    isLoadingCollections.value = true;
    const { data, error } = await supabase.fetchCollections();
    if (!error) {
      collections.value = data;
    } else {
      console.error(error);
    }
    isLoadingCollections.value = false;
  }

  async function fetchSongsByCollectionId(collectionId: number) {
    isLoadingSongs.value = true;
    const { data, error } = await supabase.fetchSongsByCollectionId(collectionId);
    if (!error) {
      songs.value = data;
      songsCollectionId.value = collectionId;
    } else {
      console.error(error);
    }
    isLoadingSongs.value = false;
  }

  function cloneLyrics(lyrics: LyricStanza[]): LyricStanza[] {
    return JSON.parse(JSON.stringify(lyrics));
  }

  /**
   * Returns true if two lyrics states differ only by a single verse's text.
   * Compares structure (with all text blanked) for equality, then counts text diffs.
   */
  function isMinorTextEdit(a: LyricStanza[], b: LyricStanza[]): boolean {
    const texts: string[][] = [[], []];
    const replacer = (idx: number) => (_key: string, val: unknown) => {
      if (_key === "text" && typeof val === "string") {
        texts[idx]!.push(val);
        return "";
      }
      return val;
    };
    // Structure check: identical when all text values are blanked
    if (JSON.stringify(a, replacer(0)) !== JSON.stringify(b, replacer(1))) return false;
    if (texts[0]!.length !== texts[1]!.length) return false;

    let diffs = 0;
    for (let i = 0; i < texts[0]!.length; i++) {
      if (texts[0]![i] !== texts[1]![i]) diffs++;
      if (diffs > 1) return false;
    }
    return diffs === 1;
  }

  async function updateLocalLyrics(value: LyricStanza[], focus?: FocusPosition | null) {
    if (_undo.inProgress) return;
    const newSnapshot = cloneLyrics(value);

    // Skip no-op updates
    if (JSON.stringify(_undo.lastSnapshot) === JSON.stringify(newSnapshot)) return;

    // Update focus before pushing so the snapshot captures the current position
    if (focus !== undefined) _undo.lastFocus = focus;

    // Collapse consecutive single-verse text edits into one undo entry:
    // if the top of the undo stack differs from the new state by only one verse's text,
    // skip pushing (the group start is already on the stack).
    const topOfStack = undoStack.value[undoStack.value.length - 1];
    if (topOfStack && isMinorTextEdit(topOfStack.lyrics, newSnapshot)) {
      // Don't push — keep the existing top of undo stack
    } else {
      undoStack.value.push({ lyrics: _undo.lastSnapshot, focus: _undo.lastFocus });
      if (undoStack.value.length > MAX_UNDO_STACK) {
        undoStack.value.shift();
      }
    }
    redoStack.value = [];
    localLyrics.value.value = value;
    localLyrics.isDirty.value = true;
    _undo.lastSnapshot = newSnapshot;
  }

  function undo(): FocusPosition | null {
    if (undoStack.value.length === 0) return null;
    _undo.inProgress = true;
    const previous = undoStack.value.pop()!;
    redoStack.value.push({ lyrics: _undo.lastSnapshot, focus: _undo.lastFocus });
    localLyrics.value.value = previous.lyrics;
    localLyrics.isDirty.value = true;
    _undo.lastSnapshot = cloneLyrics(previous.lyrics);
    _undo.lastFocus = previous.focus;
    _undo.inProgress = false;
    return previous.focus;
  }

  function redo(): FocusPosition | null {
    if (redoStack.value.length === 0) return null;
    _undo.inProgress = true;
    const next = redoStack.value.pop()!;
    undoStack.value.push({ lyrics: _undo.lastSnapshot, focus: _undo.lastFocus });
    localLyrics.value.value = next.lyrics;
    localLyrics.isDirty.value = true;
    _undo.lastSnapshot = cloneLyrics(next.lyrics);
    _undo.lastFocus = next.focus;
    _undo.inProgress = false;
    return next.focus;
  }

  async function saveLyrics() {
    localLyrics.isSaving.value = true;
    if (currentSong.value) {
      const { error } = await supabase.updateSongLyrics(
        currentSong.value.id,
        localLyrics.value.value
      );
      if (error) {
        throw error;
      } else {
        savedLyricsSnapshot.value = JSON.stringify(toRaw(localLyrics.value.value));
        localLyrics.isDirty.value = false;
      }
    }
    localLyrics.isSaving.value = false;
  }

  function discardLyricsChanges() {
    localLyrics.value.value = JSON.parse(savedLyricsSnapshot.value);
    localLyrics.isDirty.value = false;
    undoStack.value = [];
    redoStack.value = [];
  }

  const isLoading = computed(() => {
    return isLoadingCollections.value || isLoadingSongs.value;
  });

  function reset() {
    collections.value = [];
    songs.value = [];
    isLoadingCollections.value = false;
    isLoadingSongs.value = false;
    songsCollectionId.value = null;
    localLyrics.value.value = [];
    localLyrics.isDirty.value = false;
    localLyrics.isSaving.value = false;
  }

  return {
    collections,
    songs: visibleSongs,
    currentCollection,
    currentSong,
    songsCollectionId,
    isLoading,
    fetchCollections,
    fetchSongsByCollectionId,
    localLyrics,
    updateLocalLyrics,
    saveLyrics,
    discardLyricsChanges,
    undo,
    redo,
    canUndo,
    canRedo,
    currentUserRole,
    canEditCurrentCollection,
    reset
  };
});
