// Pure helpers for the collection settings screen (design/pantallas/coleccion.html).
import { differenceEuclidean } from "culori";

import type { LyricStanza, LyricVerse, Song } from "@/data/types";
import {
  type ColorRole,
  type ColorSpec,
  deriveColor,
  type Intensity,
  isNeutral,
  type Theme
} from "@/utils/palette";

// ---------- dirty state ----------

/** Keys whose values differ between the saved object and the draft (deep, via JSON). */
export function changedFields<T extends Record<string, unknown>>(saved: T, draft: T): (keyof T)[] {
  const keys = new Set<keyof T>([...Object.keys(saved), ...Object.keys(draft)] as (keyof T)[]);
  return [...keys].filter((key) => JSON.stringify(saved[key]) !== JSON.stringify(draft[key]));
}

export function changesLabel(count: number): string {
  return count === 1 ? "1 cambio sin guardar" : `${count} cambios sin guardar`;
}

/**
 * One line of the Colores change digest: what changed in a color, e.g.
 * "Tenor: 195° → 210°, media → intensa", "Piano: neutra", "Bajo: 275°, suave".
 */
export function describeColorChange(label: string, before: ColorSpec, after: ColorSpec): string {
  if (isNeutral(after)) return `${label}: neutra`;
  if (isNeutral(before)) return `${label}: ${after.hue}°, ${after.intensity}`;
  const parts: string[] = [];
  if (before.hue !== after.hue) parts.push(`${before.hue}° → ${after.hue}°`);
  if (before.intensity !== after.intensity) parts.push(`${before.intensity} → ${after.intensity}`);
  return parts.length ? `${label}: ${parts.join(", ")}` : label;
}

// ---------- hues ----------

/**
 * Two track colors closer than this (ΔE in OKLab, ×100) are hard to tell apart.
 * For scale: two "media" colors 25° apart sit around 5.7 and 15° apart around
 * 3.4; "suave" next to "intensa" never drops below 6.5, even at the same hue.
 */
export const MIN_COLOR_DISTANCE = 4;

export type PaletteEntry = { key: string; name: string; spec: ColorSpec };

export type ColorConflict = { a: string; b: string };

// Where tracks show their color: waveforms, player lyrics and swatches.
const COMPARED: [ColorRole, Theme][] = (["wave", "stage", "fill"] as const).flatMap((role) =>
  (["light", "dark"] as const).map((theme): [ColorRole, Theme] => [role, theme])
);
const deltaE = differenceEuclidean("oklab");
const paintedCache = new Map<string, string[]>();
const painted = (spec: { hue: number; intensity: Intensity }) => {
  const key = `${spec.hue}|${spec.intensity}`;
  let colors = paintedCache.get(key);
  if (!colors) {
    colors = COMPARED.map(([role, theme]) => deriveColor(spec, role, theme));
    paintedCache.set(key, colors);
  }
  return colors;
};

/**
 * How far apart two track colors look: the smallest ΔE (OKLab, ×100) among
 * the colors both paint, per role and theme. Hue, intensity and each hue's
 * lightness all count, so greens (which change slowly with hue) need more
 * degrees apart than reds. Neutral colors never compete: Infinity.
 */
export function colorDistance(a: ColorSpec, b: ColorSpec): number {
  if (isNeutral(a) || isNeutral(b)) return Infinity;
  const [pa, pb] = [painted(a), painted(b)];
  return Math.min(...pa.map((color, i) => deltaE(color, pb[i]!) * 100));
}

export const tooSimilar = (a: ColorSpec, b: ColorSpec) =>
  colorDistance(a, b) < MIN_COLOR_DISTANCE;

/** Pairs of colored (non-neutral) tracks that are hard to tell apart. */
export function colorConflicts(entries: PaletteEntry[]): ColorConflict[] {
  const conflicts: ColorConflict[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (tooSimilar(entries[i]!.spec, entries[j]!.spec)) {
        conflicts.push({ a: entries[i]!.key, b: entries[j]!.key });
      }
    }
  }
  return conflicts;
}

/**
 * The hue closest to `from` that, at this intensity, stays distinguishable
 * from every other color, or null when there is none.
 */
export function nearestFreeHue(
  from: number,
  intensity: Intensity,
  others: ColorSpec[]
): number | null {
  for (let step = 0; step <= 180; step++) {
    for (const candidate of [from + step, from - step]) {
      const hue = ((Math.round(candidate) % 360) + 360) % 360;
      if (others.every((other) => !tooSimilar({ hue, intensity }, other))) return hue;
    }
  }
  return null;
}

// ---------- color keys ----------

export const COLOR_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,23}$/;

export function colorKeyFromName(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 3) || "c";
  let key = base;
  for (let n = 2; taken.includes(key); n++) key = `${base}${n}`;
  return key;
}

/** Applies a key mapping (old → new) to every verse's color_keys, without duplicates. */
export function remapLyricColorKeys(
  lyrics: LyricStanza[] | null,
  mapping: Record<string, string>
): LyricStanza[] | null {
  if (!lyrics) return lyrics;
  const remapVerse = (verse: LyricVerse): LyricVerse => {
    if (!verse.color_keys) return verse;
    const keys = [...new Set(verse.color_keys.map((key) => mapping[key] ?? key))];
    return { ...verse, color_keys: keys };
  };
  return lyrics.map((stanza) =>
    stanza.map((item) =>
      Array.isArray(item) ? item.map((column) => column.map(remapVerse)) : remapVerse(item)
    )
  );
}

export type ColorUsage = { tracks: number; verses: number };

/** How many tracks and verses use each color key across the collection's songs. */
export function colorUsage(songs: Song[]): Record<string, ColorUsage> {
  const usage: Record<string, ColorUsage> = {};
  const bump = (key: string, field: keyof ColorUsage) => {
    usage[key] ??= { tracks: 0, verses: 0 };
    usage[key][field] += 1;
  };
  for (const song of songs) {
    for (const track of song.audio_tracks ?? []) bump(track.color_key, "tracks");
    for (const stanza of song.lyrics ?? []) {
      for (const item of stanza) {
        const verses = Array.isArray(item) ? item.flat() : [item];
        for (const verse of verses) for (const key of verse.color_keys ?? []) bump(key, "verses");
      }
    }
  }
  return usage;
}

export function usageLabel(usage: ColorUsage | undefined): string {
  const tracks = usage?.tracks ?? 0;
  const verses = usage?.verses ?? 0;
  const t = tracks === 1 ? "1 pista" : `${tracks} pistas`;
  const v = verses === 0 ? "sin versos" : verses === 1 ? "1 verso" : `${verses} versos`;
  return `${t} · ${v}`;
}

/**
 * Keys that disappear in the draft but are still used by tracks or verses: each one
 * needs a replacement before saving.
 */
export function removedKeysInUse(
  savedKeys: string[],
  draftKeys: string[],
  renames: Record<string, string>,
  usage: Record<string, ColorUsage>
): string[] {
  return savedKeys.filter(
    (key) =>
      !draftKeys.includes(key) &&
      !renames[key] &&
      ((usage[key]?.tracks ?? 0) > 0 || (usage[key]?.verses ?? 0) > 0)
  );
}

// ---------- confirmations ----------

/** Typed confirmation: trims and ignores case, nothing else. */
export function confirmationMatches(typed: string, expected: string): boolean {
  return typed.trim().toLowerCase() === expected.trim().toLowerCase();
}

// ---------- members ----------

export function lastSignInLabel(value: string | null, now: Date = new Date()): string {
  if (!value) return "nunca ingresó";
  const days = Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 14) return "hace 1 semana";
  if (days < 30) return `hace ${Math.floor(days / 7)} semanas`;
  if (days < 60) return "hace 1 mes";
  if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
  return "hace más de un año";
}

export function initials(name: string): string {
  const words = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}

export const ROLE_LABELS = { admin: "Admin", editor: "Editor", viewer: "Lector" } as const;

/** Message an admin can paste to hand over a managed account. */
export function shareMessage(origin: string, username: string, password: string): string {
  const host = origin.replace(/^https?:\/\//, "");
  return `Entrá a ${host} con el usuario ${username} y la contraseña ${password}.`;
}

// ---------- hue slider labels ----------

/**
 * Rows for the track labels under the hue slider, so close hues don't print on
 * top of each other. Labels are centered on their mark; each goes to the first
 * row where it doesn't overlap the previous label. Widths are estimated from the
 * text length (the labels are short, one font size).
 */
export function hueLabelRows(
  marks: readonly { hue: number; label: string }[],
  widthPx: number,
  charPx = 6.4,
  gapPx = 8
): number[] {
  const order = marks
    .map((mark, index) => ({ index, center: (mark.hue / 359) * widthPx, half: (mark.label.length * charPx) / 2 }))
    .sort((a, b) => a.center - b.center);
  const rowEnds: number[] = [];
  const rows = new Array<number>(marks.length).fill(0);
  for (const item of order) {
    const start = item.center - item.half;
    let row = rowEnds.findIndex((end) => start >= end + gapPx);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = item.center + item.half;
    rows[item.index] = row;
  }
  return rows;
}
