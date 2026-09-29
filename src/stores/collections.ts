import { defineStore } from "pinia";
import { computed, ref, toRaw, watch } from "vue";
import { useRoute } from "vue-router";

import * as supabase from "@/data/supabase";
import { resolveAudioTrackUrls, resolveCollectionArtwork } from "@/data/storage";
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
  // The last saved lyrics, for comparisons such as "6 tiempos nuevos" in Sincronizar
  const savedLyrics = computed<LyricStanza[]>(() => JSON.parse(savedLyricsSnapshot.value));

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

  // Old slug → new slug for songs renamed in this session, so the route that still points
  // at the old address keeps resolving to the song until navigation catches up.
  const renamedSongSlugs = ref<Record<string, string>>({});

  const currentSong = computed(() => {
    const slug = route.params.songSlug as string;
    if (!slug) return null;
    const found = visibleSongs.value.find((s) => s.slug === slug);
    if (found) return found;
    const renamed = renamedSongSlugs.value[slug];
    return (renamed && visibleSongs.value.find((s) => s.slug === renamed)) || null;
  });

  // Auto-fetch songs when collection changes
  watch(
    currentCollection,
    async (collection, previousCollection) => {
      const sameCollection = collection?.id === previousCollection?.id;
      if (!sameCollection) {
        songs.value = [];
        songsCollectionId.value = null;
        localLyrics.value.value = [];
        localLyrics.isDirty.value = false;
      }
      if (collection) {
        // Same collection re-resolved (e.g. collections refetched): refresh quietly,
        // without swapping the screen for the loading state.
        await fetchSongsByCollectionId(collection.id, {
          background: sameCollection && songsCollectionId.value === collection.id
        });
      }
    },
    { immediate: true }
  );

  function resetUndo() {
    undoStack.value = [];
    redoStack.value = [];
    _undo.lastSnapshot = cloneLyrics(localLyrics.value.value);
    _undo.lastFocus = null;
  }

  // Update local lyrics when song changes
  watch(
    currentSong,
    (song, previousSong) => {
      if (song && previousSong && song.id === previousSong.id) {
        // Same song refreshed (songs refetched or patched after a save). Never throw away
        // unsaved edits; when clean, follow the database copy but keep the undo history.
        if (localLyrics.isDirty.value) return;
        const incoming = JSON.stringify(song.lyrics ?? []);
        if (incoming !== savedLyricsSnapshot.value) {
          savedLyricsSnapshot.value = incoming;
          localLyrics.value.value = JSON.parse(incoming);
          resetUndo();
        }
        return;
      }
      if (song) {
        savedLyricsSnapshot.value = JSON.stringify(song.lyrics ?? []);
        localLyrics.value.value = JSON.parse(savedLyricsSnapshot.value);
        localLyrics.isDirty.value = false;
      } else {
        savedLyricsSnapshot.value = "[]";
        localLyrics.value.value = [];
        localLyrics.isDirty.value = false;
      }
      resetUndo();
    },
    { immediate: true }
  );

  // Data fetching methods (no navigation logic)
  async function fetchCollections() {
    isLoadingCollections.value = true;
    const { data, error } = await supabase.fetchCollections();
    if (!error) {
      collections.value = await Promise.all(
        data.map(async (collection) => {
          try {
            return (await resolveCollectionArtwork(collection)) as CollectionWithRole;
          } catch (storageError) {
            console.error(storageError);
            return collection;
          }
        })
      );
    } else {
      console.error(error);
    }
    isLoadingCollections.value = false;
  }

  // Ensure the collection for a given slug is available in `collections`, fetching it
  // directly when it isn't part of the listed/owned set. This is what makes "unlisted"
  // (and public) collections reachable by link without showing up in the sidebar listing.
  // Members and listed collections are already loaded by fetchCollections, so the by-slug
  // fetch only ever resolves collections the user accesses purely via their link → viewer.
  async function ensureCollectionLoaded(slug: string | null | undefined) {
    if (!slug || collections.value.some((c) => c.slug === slug)) return;
    isLoadingCollections.value = true;
    const { data, error } = await supabase.fetchCollectionBySlug(slug);
    if (error) {
      console.error(error);
    } else if (data && !collections.value.some((c) => c.id === data.id)) {
      let collection = data;
      try {
        collection = await resolveCollectionArtwork(data);
      } catch (storageError) {
        console.error(storageError);
      }
      collections.value.push({ ...collection, user_role: "viewer", is_member: false });
    }
    isLoadingCollections.value = false;
  }

  /**
   * Loads the songs of a collection. `background` refreshes without flipping `isLoading`,
   * so views keep showing (and playing) the current song while the list updates.
   */
  async function fetchSongsByCollectionId(
    collectionId: number,
    options: { background?: boolean } = {}
  ) {
    const background = options.background ?? false;
    if (!background) isLoadingSongs.value = true;
    const { data, error } = await supabase.fetchSongsByCollectionId(collectionId);
    if (!error) {
      const sourceTracks = data.flatMap((song) => song.audio_tracks);
      let tracks = sourceTracks;
      try {
        tracks = await resolveAudioTrackUrls(sourceTracks);
      } catch (storageError) {
        console.error(storageError);
      }
      const tracksById = new Map(tracks.map((track) => [track.id, track]));
      songs.value = data.map((song) => ({
        ...song,
        audio_tracks: song.audio_tracks.map((track) => tracksById.get(track.id) ?? track)
      }));
      songsCollectionId.value = collectionId;
    } else {
      console.error(error);
    }
    if (!background) isLoadingSongs.value = false;
  }

  /** Applies saved changes to a loaded song in place (no refetch, no loading state). */
  function patchSong(songId: number, changes: Partial<Omit<Song, "id">>) {
    const previous = songs.value.find((song) => song.id === songId);
    if (previous && changes.slug && changes.slug !== previous.slug) {
      renamedSongSlugs.value = { ...renamedSongSlugs.value, [previous.slug]: changes.slug };
    }
    songs.value = songs.value.map((song) => (song.id === songId ? { ...song, ...changes } : song));
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
    const song = currentSong.value;
    if (!song) return;
    // Save what's on screen now; edits typed while the request is in flight stay dirty.
    const snapshot = cloneLyrics(toRaw(localLyrics.value.value));
    localLyrics.isSaving.value = true;
    try {
      const { error } = await supabase.updateSongLyrics(song.id, snapshot);
      if (error) throw error;
      savedLyricsSnapshot.value = JSON.stringify(snapshot);
      localLyrics.isDirty.value =
        JSON.stringify(toRaw(localLyrics.value.value)) !== savedLyricsSnapshot.value;
      // Keep the loaded song in sync so a later refresh or song switch doesn't bring back
      // the old lyrics.
      patchSong(song.id, { lyrics: snapshot });
    } finally {
      localLyrics.isSaving.value = false;
    }
  }

  function discardLyricsChanges() {
    localLyrics.value.value = JSON.parse(savedLyricsSnapshot.value);
    localLyrics.isDirty.value = false;
    resetUndo();
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
    ensureCollectionLoaded,
    fetchSongsByCollectionId,
    patchSong,
    localLyrics,
    savedLyrics,
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
