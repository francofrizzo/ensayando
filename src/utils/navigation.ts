import type { CollectionWithRole, Song } from "@/data/types";

// ---------- text matching ----------

/** Lowercase without accents, so "cancion" finds "Canción". */
export const normalizeText = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type TextSegment = { text: string; match: boolean };

/**
 * Splits `text` into matched and unmatched segments for highlighting. Matching
 * ignores case and accents; the segments keep the original characters (NFD
 * normalization only strips combining marks, so indexes line up with NFC input).
 */
export const highlightMatch = (text: string, query: string): TextSegment[] => {
  const needle = normalizeText(query.trim());
  if (!needle) return [{ text, match: false }];
  const haystack = normalizeText(text);
  const segments: TextSegment[] = [];
  let cursor = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    if (index > cursor) segments.push({ text: text.slice(cursor, index), match: false });
    segments.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
    index = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
};

export const matchesQuery = (text: string, query: string) => {
  const needle = normalizeText(query.trim());
  return !needle || normalizeText(text).includes(needle);
};

export const filterSongs = <T extends Pick<Song, "title">>(songs: T[], query: string): T[] =>
  songs.filter((song) => matchesQuery(song.title, query));

// ---------- durations ----------

type SongWithDuration = Pick<Song, "duration"> & {
  audio_tracks?: Array<{ peaks: { duration: number } | null }>;
};

/** Seconds from songs.duration, else the first track's peaks; null when unknown. */
export const songDuration = (song: SongWithDuration): number | null => {
  if (typeof song.duration === "number" && song.duration > 0) return song.duration;
  const peaksDuration = song.audio_tracks?.[0]?.peaks?.duration;
  return typeof peaksDuration === "number" && peaksDuration > 0 ? peaksDuration : null;
};

/** "3:07" */
export const formatDuration = (seconds: number) => {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
};

/** Total only when every song's duration is known: "25 min", "1 h 5 min". */
export const totalDuration = (songs: SongWithDuration[]): string | null => {
  if (songs.length === 0) return null;
  let sum = 0;
  for (const song of songs) {
    const seconds = songDuration(song);
    if (seconds === null) return null;
    sum += seconds;
  }
  const minutes = Math.round(sum / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

export const songCountLabel = (count: number) =>
  `${count} ${count === 1 ? "canción" : "canciones"}`;

// ---------- collections ----------

const SMALL_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "a", "en", "para"]);

/** Initials for the generated home banner: "Coro del Puerto · 2026" → "CP". */
export const collectionInitials = (title: string) => {
  const words = title
    .split(/[\s·\-–—/]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const significant = words.filter((word) => !SMALL_WORDS.has(word.toLowerCase()));
  const lettered = significant.filter((word) => /\p{L}/u.test(word[0]!));
  const pick = (lettered.length ? lettered : significant.length ? significant : words).slice(0, 2);
  return pick.map((word) => word[0]!.toUpperCase()).join("");
};

/**
 * With exactly one collection the person belongs to, "/" goes straight to it.
 * Public collections they aren't a member of don't count.
 */
export const directCollection = <T extends Pick<CollectionWithRole, "is_member">>(
  collections: T[]
): T | null => {
  const members = collections.filter((collection) => collection.is_member);
  return members.length === 1 ? members[0]! : null;
};

export const ROLE_LABELS: Record<CollectionWithRole["user_role"], string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Lector"
};

export const VISIBILITY_LABELS: Record<CollectionWithRole["visibility"], string> = {
  public: "Pública",
  unlisted: "No listada",
  private: "Privada"
};

// ---------- command palette ----------

export type CommandSong = Pick<Song, "id" | "title" | "slug" | "collection_id" | "visible">;

export type CommandAction = { id: string; label: string; hint?: string };

export type CommandItem =
  | { kind: "song"; key: string; label: string; detail: string; song: CommandSong }
  | { kind: "collection"; key: string; label: string; collection: CollectionWithRole }
  | { kind: "action"; key: string; label: string; hint?: string; action: CommandAction };

export type CommandGroup = {
  id: "songs" | "collections" | "actions";
  label: string;
  items: CommandItem[];
};

export const COMMAND_GROUP_LIMIT = 6;

/**
 * Songs, collections and actions matching the query, in that order. Without a
 * query, songs of the current collection come first so the palette opens useful.
 */
export const buildCommandGroups = (
  query: string,
  data: {
    songs: CommandSong[];
    collections: CollectionWithRole[];
    actions: CommandAction[];
    currentCollectionId?: number | null;
  }
): CommandGroup[] => {
  const byId = new Map(data.collections.map((collection) => [collection.id, collection]));
  const hasQuery = query.trim().length > 0;

  const songs = data.songs
    .filter((song) => byId.has(song.collection_id))
    .filter((song) =>
      hasQuery ? matchesQuery(song.title, query) : song.collection_id === data.currentCollectionId
    )
    .sort((a, b) => {
      // Songs of the current collection first
      const aCurrent = a.collection_id === data.currentCollectionId ? 0 : 1;
      const bCurrent = b.collection_id === data.currentCollectionId ? 0 : 1;
      return aCurrent - bCurrent;
    })
    .slice(0, COMMAND_GROUP_LIMIT)
    .map<CommandItem>((song) => ({
      kind: "song",
      key: `song-${song.id}`,
      label: song.title,
      detail: byId.get(song.collection_id)!.title,
      song
    }));

  const collections = data.collections
    .filter((collection) => hasQuery && matchesQuery(collection.title, query))
    .slice(0, COMMAND_GROUP_LIMIT)
    .map<CommandItem>((collection) => ({
      kind: "collection",
      key: `collection-${collection.id}`,
      label: collection.title,
      collection
    }));

  const actions = data.actions
    .filter((action) => matchesQuery(action.label, query))
    .map<CommandItem>((action) => ({
      kind: "action",
      key: `action-${action.id}`,
      label: action.label,
      hint: action.hint,
      action
    }));

  return (
    [
      { id: "songs", label: "Canciones", items: songs },
      { id: "collections", label: "Colecciones", items: collections },
      { id: "actions", label: "Acciones", items: actions }
    ] satisfies CommandGroup[]
  ).filter((group) => group.items.length > 0);
};

/** Songs a person may see in the palette: hidden ones only for editors and admins. */
export const visibleIndexSongs = (songs: CommandSong[], collections: CollectionWithRole[]) => {
  const roles = new Map(collections.map((collection) => [collection.id, collection.user_role]));
  return songs.filter((song) => {
    const role = roles.get(song.collection_id);
    if (!role) return false;
    return song.visible !== false || role === "admin" || role === "editor";
  });
};

// ---------- generated banner ----------

/**
 * Background for a collection card without artwork: the collection hue as a
 * lit gradient. Chroma is capped so no hue clips harshly in sRGB.
 */
export const bannerBackground = (hue: number, chroma: number) => {
  const c = Math.min(chroma, 0.16);
  return [
    `radial-gradient(80% 70% at 25% 20%, oklch(0.72 ${c} ${hue}), transparent 60%)`,
    `radial-gradient(70% 60% at 85% 90%, oklch(0.6 ${c} ${(hue + 40) % 360}), transparent 65%)`,
    `linear-gradient(160deg, oklch(0.5 ${c} ${hue}), oklch(0.32 ${c} ${(hue + 30) % 360}))`
  ].join(", ");
};
