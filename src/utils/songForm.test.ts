import { describe, expect, it } from "vitest";

import type { AudioTrack } from "@/data/types";
import {
  formatBytes,
  formatDuration,
  isAudioFile,
  moveItem,
  nextColorKey,
  songFormChanges,
  storedFileName,
  titlesFromFilenames,
  tracksWithoutAudio,
  withOrder
} from "@/utils/songForm";

const track = (id: number, extra: Partial<AudioTrack> = {}): AudioTrack => ({
  id,
  song_id: 1,
  title: `Pista ${id}`,
  color_key: "sop",
  audio_file_url: "",
  audio_file_key: `audio/1/${id}.mp3`,
  peaks: null,
  order: id,
  created_at: "2026-01-01T00:00:00Z",
  ...extra
});

describe("titlesFromFilenames", () => {
  it("cleans a single file name", () => {
    expect(titlesFromFilenames(["voz_principal.mp3"])).toEqual(["Voz principal"]);
  });

  it("drops the words every file shares at the start", () => {
    expect(
      titlesFromFilenames(["vidala-soprano.mp3", "vidala-tenor.mp3", "vidala-piano.wav"])
    ).toEqual(["Soprano", "Tenor", "Piano"]);
  });

  it("drops the song's slug, accents aside", () => {
    expect(titlesFromFilenames(["Canción del puerto - Bajo.mp3"], "cancion-del-puerto")).toEqual([
      "Bajo"
    ]);
  });

  it("never leaves a title empty", () => {
    expect(titlesFromFilenames(["vidala.mp3"], "vidala")).toEqual(["Vidala"]);
    expect(titlesFromFilenames(["mix.mp3", "mix.wav"])).toEqual(["Mix", "Mix"]);
  });
});

describe("isAudioFile", () => {
  it("accepts audio by type or extension", () => {
    expect(isAudioFile({ name: "a.mp3", type: "" })).toBe(true);
    expect(isAudioFile({ name: "a", type: "audio/wav" })).toBe(true);
    expect(isAudioFile({ name: "a.pdf", type: "application/pdf" })).toBe(false);
  });
});

describe("moveItem and withOrder", () => {
  it("moves and renumbers", () => {
    const moved = moveItem([track(1), track(2), track(3)], 2, 0);
    expect(moved.map((t) => t.id)).toEqual([3, 1, 2]);
    expect(withOrder(moved).map((t) => t.order)).toEqual([1, 2, 3]);
  });

  it("clamps the target and ignores bad indexes", () => {
    expect(moveItem([1, 2, 3], 0, 9)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 5, 0)).toEqual([1, 2, 3]);
  });
});

describe("nextColorKey", () => {
  it("picks the first unused color, then cycles", () => {
    expect(nextColorKey(["sop"], ["sop", "alt", "ten"])).toBe("alt");
    expect(nextColorKey(["sop", "alt", "ten"], ["sop", "alt", "ten"])).toBe("sop");
    expect(nextColorKey([], [])).toBe("");
  });
});

describe("formatting", () => {
  it("formats sizes and durations", () => {
    expect(formatBytes(2.7 * 1024 * 1024)).toBe("2,7 MB");
    expect(formatBytes(830 * 1024)).toBe("830 KB");
    expect(formatDuration(168)).toBe("2:48");
    expect(formatDuration(5.4)).toBe("0:05");
  });
});

describe("songFormChanges", () => {
  const saved = {
    title: "Vidala",
    slug: "vidala",
    visible: true,
    audio_tracks: [track(1), track(2)]
  };

  it("is empty when nothing changed, even with signed URLs attached", () => {
    const form = {
      ...saved,
      audio_tracks: saved.audio_tracks.map((t) => ({ ...t, playback_url: "https://signed" }))
    };
    expect(songFormChanges(form, saved)).toEqual([]);
  });

  it("names basic, order, set and detail changes", () => {
    expect(songFormChanges({ ...saved, title: "Otra", visible: false }, saved)).toEqual([
      "title",
      "visible"
    ]);
    expect(
      songFormChanges({ ...saved, audio_tracks: withOrder([track(2), track(1)]) }, saved)
    ).toEqual(["order"]);
    expect(songFormChanges({ ...saved, audio_tracks: [track(1)] }, saved)).toEqual(["tracks"]);
    expect(
      songFormChanges({ ...saved, audio_tracks: [track(1, { title: "Voz" }), track(2)] }, saved)
    ).toEqual(["track-details"]);
  });
});

describe("tracksWithoutAudio", () => {
  it("finds tracks with neither a stored file nor a URL", () => {
    const empty = track(3, { audio_file_key: null, audio_file_url: "" });
    const byUrl = track(4, { audio_file_key: null, audio_file_url: "https://x/a.mp3" });
    expect(tracksWithoutAudio([track(1), empty, byUrl])).toEqual([empty]);
  });
});

describe("storedFileName", () => {
  it("shows the format for uploads saved under a random name", () => {
    expect(storedFileName("audio/12/3f2c9a1e-8b7d-4c6e-9f10-2a3b4c5d6e7f.mp3")).toBe("Audio MP3");
  });

  it("keeps a readable file name from an old URL", () => {
    expect(storedFileName("https://cdn.example.com/voces/Voz%201%20-%20soprano.wav?x=1")).toBe(
      "Voz 1 - soprano.wav"
    );
  });

  it("returns null when there is nothing readable", () => {
    expect(storedFileName("audio/12/3f2c9a1e-8b7d-4c6e-9f10-2a3b4c5d6e7f")).toBeNull();
    expect(storedFileName("https://cdn.example.com/")).toBeNull();
  });
});
