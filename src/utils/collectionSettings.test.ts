import { describe, expect, it } from "vitest";

import type { LyricStanza, Song } from "@/data/types";

import {
  changedFields,
  changesLabel,
  colorKeyFromName,
  colorUsage,
  confirmationMatches,
  hueConflicts,
  hueDistance,
  initials,
  lastSignInLabel,
  nearestFreeHue,
  remapLyricColorKeys,
  removedKeysInUse,
  shareMessage,
  usageLabel
} from "./collectionSettings";

describe("changedFields", () => {
  it("lists only the fields that differ, deeply", () => {
    const saved = { title: "A", visibility: "private", colors: { a: 1 } };
    const draft = { title: "B", visibility: "private", colors: { a: 2 } };
    expect(changedFields(saved, draft)).toEqual(["title", "colors"]);
  });

  it("is empty when nothing changed", () => {
    expect(changedFields({ a: [1, 2] }, { a: [1, 2] })).toEqual([]);
  });

  it("labels the count", () => {
    expect(changesLabel(1)).toBe("1 cambio sin guardar");
    expect(changesLabel(3)).toBe("3 cambios sin guardar");
  });
});

describe("hues", () => {
  it("measures distance around the circle", () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(195, 207)).toBe(12);
    expect(hueDistance(0, 180)).toBe(180);
  });

  it("flags tracks closer than 25°, ignoring neutral ones", () => {
    const conflicts = hueConflicts([
      { key: "ten", name: "Tenor", spec: { hue: 195, intensity: "normal" } },
      { key: "baj", name: "Bajo", spec: { hue: 207, intensity: "normal" } },
      { key: "sop", name: "Soprano", spec: { hue: 350, intensity: "normal" } },
      { key: "clic", name: "Clic", spec: { neutral: true } }
    ]);
    expect(conflicts).toEqual([{ a: "ten", b: "baj", distance: 12 }]);
  });

  it("finds the closest free hue", () => {
    expect(nearestFreeHue(207, [195, 350, 70])).toBe(220);
    expect(nearestFreeHue(100, [])).toBe(100);
  });

  it("returns null when every hue is taken", () => {
    const everyTwenty = Array.from({ length: 18 }, (_, i) => i * 20);
    expect(nearestFreeHue(5, everyTwenty)).toBeNull();
  });
});

describe("color keys", () => {
  it("derives a short unique key from the name", () => {
    expect(colorKeyFromName("Contralto", [])).toBe("con");
    expect(colorKeyFromName("Contralto", ["con"])).toBe("con2");
    expect(colorKeyFromName("Ñandú", [])).toBe("nan");
    expect(colorKeyFromName("!!", [])).toBe("c");
  });

  it("remaps verse keys in stanzas and columns without duplicates", () => {
    const lyrics: LyricStanza[] = [
      [
        { text: "uno", color_keys: ["sop", "alt"] },
        [[{ text: "dos", color_keys: ["alt"] }], [{ text: "tres" }]]
      ]
    ];
    expect(remapLyricColorKeys(lyrics, { alt: "sop" })).toEqual([
      [
        { text: "uno", color_keys: ["sop"] },
        [[{ text: "dos", color_keys: ["sop"] }], [{ text: "tres" }]]
      ]
    ]);
    expect(remapLyricColorKeys(null, { a: "b" })).toBeNull();
  });

  it("counts usage per key", () => {
    const songs = [
      {
        audio_tracks: [{ color_key: "sop" }, { color_key: "alt" }],
        lyrics: [[{ text: "a", color_keys: ["sop"] }, [[{ text: "b", color_keys: ["sop", "alt"] }]]]]
      },
      { audio_tracks: [{ color_key: "sop" }], lyrics: null }
    ] as unknown as Song[];
    expect(colorUsage(songs)).toEqual({
      sop: { tracks: 2, verses: 2 },
      alt: { tracks: 1, verses: 1 }
    });
    expect(usageLabel({ tracks: 1, verses: 0 })).toBe("1 pista · sin versos");
    expect(usageLabel({ tracks: 2, verses: 31 })).toBe("2 pistas · 31 versos");
  });

  it("asks for a replacement only for removed keys still in use", () => {
    const usage = { sop: { tracks: 1, verses: 0 }, old: { tracks: 0, verses: 0 } };
    expect(removedKeysInUse(["sop", "old", "alt"], ["alt"], {}, usage)).toEqual(["sop"]);
    expect(removedKeysInUse(["sop"], ["sopr"], { sop: "sopr" }, usage)).toEqual([]);
  });
});

describe("members and confirmations", () => {
  it("matches typed confirmations loosely", () => {
    expect(confirmationMatches("  Coro-Puerto ", "coro-puerto")).toBe(true);
    expect(confirmationMatches("coro", "coro-puerto")).toBe(false);
  });

  it("describes the last sign-in", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    expect(lastSignInLabel(null, now)).toBe("nunca ingresó");
    expect(lastSignInLabel("2026-09-29T08:00:00Z", now)).toBe("hoy");
    expect(lastSignInLabel("2026-09-27T08:00:00Z", now)).toBe("hace 2 días");
    expect(lastSignInLabel("2026-09-20T08:00:00Z", now)).toBe("hace 1 semana");
    expect(lastSignInLabel("2025-01-01T08:00:00Z", now)).toBe("hace más de un año");
  });

  it("builds initials and the share message", () => {
    expect(initials("Sofía R.")).toBe("SR");
    expect(initials("martin.b")).toBe("MB");
    expect(initials("lucia")).toBe("LU");
    expect(shareMessage("https://ensayando.com.ar", "lucia", "abcd-efgh-jkmn")).toBe(
      "Entrá a ensayando.com.ar con el usuario lucia y la contraseña abcd-efgh-jkmn."
    );
  });
});
