import { describe, expect, it } from "vitest";

import type { CollectionWithRole } from "@/data/types";
import {
  buildCommandGroups,
  collectionInitials,
  type CommandSong,
  directCollection,
  filterSongs,
  formatDuration,
  highlightMatch,
  songDuration,
  totalDuration,
  visibleIndexSongs
} from "@/utils/navigation";

const collection = (
  id: number,
  title: string,
  extra: Partial<CollectionWithRole> = {}
): CollectionWithRole => ({
  id,
  slug: `c-${id}`,
  title,
  hue: 300,
  intensity: "normal",
  track_colors: {},
  artwork_file_url: null,
  visibility: "private",
  created_by: null,
  created_at: "2026-01-01",
  user_role: "viewer",
  is_member: true,
  ...extra
});

const song = (id: number, title: string, collectionId: number, visible = true): CommandSong => ({
  id,
  title,
  slug: `s-${id}`,
  collection_id: collectionId,
  visible
});

describe("collectionInitials", () => {
  it("skips small words and punctuation", () => {
    expect(collectionInitials("Coro del Puerto · 2026")).toBe("CP");
    expect(collectionInitials("Taller de musicales")).toBe("TM");
    expect(collectionInitials("Ensamble vocal abierto")).toBe("EV");
  });

  it("handles single words, accents and numbers", () => {
    expect(collectionInitials("Ópera")).toBe("Ó");
    expect(collectionInitials("2026")).toBe("2");
    expect(collectionInitials("la banda")).toBe("B");
  });
});

describe("directCollection", () => {
  it("goes straight in with exactly one member collection", () => {
    const own = collection(1, "Mía");
    const publicOne = collection(2, "Pública", { is_member: false, visibility: "public" });
    expect(directCollection([own, publicOne])).toBe(own);
  });

  it("shows the grid with two or more member collections, or none", () => {
    expect(directCollection([collection(1, "A"), collection(2, "B")])).toBeNull();
    expect(directCollection([collection(2, "Pública", { is_member: false })])).toBeNull();
    expect(directCollection([])).toBeNull();
  });
});

describe("text matching", () => {
  it("filters ignoring case and accents", () => {
    const songs = [{ title: "Canción del puerto" }, { title: "Vidala del viento" }];
    expect(filterSongs(songs, "CANCION")).toEqual([songs[0]]);
    expect(filterSongs(songs, "  ")).toEqual(songs);
  });

  it("highlights every match keeping the original text", () => {
    expect(highlightMatch("Vidala, vidala", "vid")).toEqual([
      { text: "Vid", match: true },
      { text: "ala, ", match: false },
      { text: "vid", match: true },
      { text: "ala", match: false }
    ]);
    expect(highlightMatch("Canción", "cion")).toEqual([
      { text: "Can", match: false },
      { text: "ción", match: true }
    ]);
  });
});

describe("durations", () => {
  it("prefers songs.duration and falls back to the first track's peaks", () => {
    expect(songDuration({ duration: 187 })).toBe(187);
    expect(songDuration({ duration: null, audio_tracks: [{ peaks: { duration: 42.4 } }] })).toBe(
      42.4
    );
    expect(songDuration({ duration: null, audio_tracks: [{ peaks: null }] })).toBeNull();
  });

  it("formats times and totals only when every duration is known", () => {
    expect(formatDuration(187.4)).toBe("3:07");
    expect(totalDuration([{ duration: 600 }, { duration: 900 }])).toBe("25 min");
    expect(totalDuration([{ duration: 3000 }, { duration: 900 }])).toBe("1 h 5 min");
    expect(totalDuration([{ duration: 600 }, { duration: null }])).toBeNull();
    expect(totalDuration([])).toBeNull();
  });
});

describe("command palette", () => {
  const coro = collection(1, "Coro del Puerto");
  const taller = collection(2, "Taller de musicales");
  const songs = [
    song(1, "Vidala del viento", 1),
    song(2, "Canción del puerto", 1),
    song(3, "Vidala nueva", 2)
  ];
  const actions = [
    { id: "download-mix", label: "Descargar mezcla" },
    { id: "theme-dark", label: "Tema oscuro" }
  ];

  it("groups songs, collections and actions that match, current collection first", () => {
    const groups = buildCommandGroups("vid", {
      songs,
      collections: [coro, taller],
      actions,
      currentCollectionId: 2
    });
    expect(groups.map((g) => g.id)).toEqual(["songs"]);
    expect(groups[0]!.items.map((i) => i.label)).toEqual(["Vidala nueva", "Vidala del viento"]);
  });

  it("matches collections and actions by name", () => {
    const groups = buildCommandGroups("taller", { songs, collections: [coro, taller], actions });
    expect(groups.map((g) => g.id)).toEqual(["collections"]);
    const byAction = buildCommandGroups("mezcla", { songs, collections: [coro, taller], actions });
    expect(byAction[0]!.items[0]).toMatchObject({ kind: "action", label: "Descargar mezcla" });
  });

  it("without a query lists the current collection's songs and every action", () => {
    const groups = buildCommandGroups("", {
      songs,
      collections: [coro, taller],
      actions,
      currentCollectionId: 1
    });
    expect(groups.map((g) => g.id)).toEqual(["songs", "actions"]);
    expect(groups[0]!.items).toHaveLength(2);
    expect(groups[1]!.items).toHaveLength(2);
  });

  it("hides hidden songs from viewers but not from editors", () => {
    const hidden = song(9, "Oculta", 1, false);
    expect(visibleIndexSongs([hidden], [coro])).toEqual([]);
    expect(visibleIndexSongs([hidden], [{ ...coro, user_role: "editor" }])).toEqual([hidden]);
    expect(visibleIndexSongs([song(10, "Otra", 99)], [coro])).toEqual([]);
  });
});
