// Pure helpers for the Canción tab (song details and tracks).

import type { AudioTrack } from "@/data/types";

export const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;
const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/flac"
];

export const isAudioFile = (file: { name: string; type: string }) =>
  AUDIO_TYPES.includes(file.type) || AUDIO_EXTENSIONS.test(file.name);

const words = (name: string) =>
  name
    .replace(/\.[^/.]+$/, "")
    .split(/[\s_\-.]+/)
    .filter(Boolean);

const capitalize = (text: string) =>
  text ? text[0]!.toLocaleUpperCase("es") + text.slice(1) : text;

const normalize = (word: string) => word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Track titles from audio file names. Words every file shares at the start (usually the
 * song, as in "vidala-tenor.mp3", "vidala-piano.mp3") and the song's own slug words are
 * dropped, so the tracks read "Tenor" and "Piano". A name is never left empty.
 */
export function titlesFromFilenames(names: string[], songSlug = ""): string[] {
  const split = names.map(words);
  const slugWords = songSlug.split("-").filter(Boolean);

  let shared = 0;
  if (split.length > 1) {
    const shortest = Math.min(...split.map((w) => w.length));
    while (
      shared < shortest - 1 &&
      split.every((w) => normalize(w[shared]!) === normalize(split[0]![shared]!))
    ) {
      shared++;
    }
  }

  return split.map((fileWords) => {
    let rest = fileWords.slice(shared);
    if (
      slugWords.length > 0 &&
      rest.length > slugWords.length &&
      slugWords.every((word, i) => normalize(rest[i]!) === word)
    ) {
      rest = rest.slice(slugWords.length);
    }
    const title = (rest.length > 0 ? rest : fileWords).join(" ");
    return capitalize(title);
  });
}

/** Moves one item, returning a new array. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list];
  const result = [...list];
  const [item] = result.splice(from, 1);
  result.splice(Math.max(0, Math.min(to, result.length)), 0, item!);
  return result;
}

/** Order follows position, from 1. */
export const withOrder = <T extends { order: number | null }>(tracks: readonly T[]): T[] =>
  tracks.map((track, i) => ({ ...track, order: i + 1 }));

/** The first collection color no track uses yet; cycles when all are taken. */
export function nextColorKey(used: readonly string[], available: readonly string[]): string {
  if (available.length === 0) return "";
  const free = available.find((key) => !used.includes(key));
  return free ?? available[used.length % available.length]!;
}

/** "2,7 MB", "830 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "2:48". */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Fields of a track that saving writes; the rest (signed URLs, dates) doesn't count as a change.
const TRACK_FIELDS = [
  "id",
  "title",
  "color_key",
  "audio_file_url",
  "audio_file_key",
  "order",
  "peaks"
] as const;

const trackSnapshot = (track: AudioTrack) =>
  JSON.stringify(TRACK_FIELDS.map((field) => track[field] ?? null));

export type SongFormState = {
  title: string;
  slug: string;
  visible: boolean;
  audio_tracks: AudioTrack[];
};

/** What changed against the saved song, for the dirty state. Empty when nothing did. */
export function songFormChanges(
  form: SongFormState,
  saved: { title: string; slug: string; visible: boolean; audio_tracks: AudioTrack[] }
): string[] {
  const changes: string[] = [];
  if (form.title !== saved.title) changes.push("title");
  if (form.slug !== saved.slug) changes.push("slug");
  if (form.visible !== saved.visible) changes.push("visible");

  const savedTracks = [...saved.audio_tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const formIds = form.audio_tracks.map((t) => t.id);
  const savedIds = savedTracks.map((t) => t.id);
  const sameSet =
    formIds.length === savedIds.length && formIds.every((id) => savedIds.includes(id));

  if (!sameSet) {
    changes.push("tracks");
  } else if (formIds.some((id, i) => id !== savedIds[i])) {
    changes.push("order");
  }
  if (sameSet) {
    const byId = new Map(savedTracks.map((t) => [t.id, t]));
    const edited = form.audio_tracks.some((track) => {
      const original = byId.get(track.id)!;
      return trackSnapshot({ ...track, order: original.order }) !== trackSnapshot(original);
    });
    if (edited) changes.push("track-details");
  }
  return changes;
}

/** Tracks that can't be saved because they have no audio yet. */
export const tracksWithoutAudio = (tracks: readonly AudioTrack[]) =>
  tracks.filter((track) => !track.audio_file_key && !track.audio_file_url);

const UUID_NAME = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// Label for audio that's already stored. Uploads are saved under random names, so
// the original file name is gone: show the format instead ("Audio MP3"). Old URLs
// with a readable file name keep it.
export function storedFileName(path: string): string | null {
  const last = path.split("?")[0]!.split("#")[0]!.split("/").pop() ?? "";
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {
    // keep the raw segment
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot + 1).toUpperCase() : "";
  if (!base) return null;
  if (UUID_NAME.test(base)) return extension ? `Audio ${extension}` : null;
  return name;
}
