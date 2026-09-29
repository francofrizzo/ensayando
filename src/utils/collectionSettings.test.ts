import { describe, expect, it } from "vitest";

import type { LyricStanza, Song } from "@/data/types";
import type { ColorSpec } from "@/utils/palette";

import {
  hueLabelRows,
  changedFields,
  changesLabel,
  colorKeyFromName,
  colorUsage,
  confirmationMatches,
  describeColorChange,
  colorConflicts,
  colorDistance,
  tooSimilar,
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

describe("color conflicts", () => {
  const media = (hue: number): ColorSpec => ({ hue, intensity: "media" });

  it("flags colors that look alike, ignoring neutral ones", () => {
    const conflicts = colorConflicts([
      { key: "ten", name: "Tenor", spec: media(195) },
      { key: "baj", name: "Bajo", spec: media(207) },
      { key: "sop", name: "Soprano", spec: media(350) },
      { key: "clic", name: "Clic", spec: { neutral: true } }
    ]);
    expect(conflicts).toEqual([{ a: "ten", b: "baj" }]);
  });

  it("counts intensity: suave next to intensa reads apart even at the same hue", () => {
    for (let hue = 0; hue < 360; hue += 10) {
      expect(tooSimilar({ hue, intensity: "suave" }, { hue, intensity: "intensa" })).toBe(false);
      expect(tooSimilar({ hue, intensity: "media" }, { hue: hue + 5, intensity: "media" })).toBe(true);
    }
  });

  it("lets well-separated hues through", () => {
    for (let hue = 0; hue < 360; hue += 10) {
      expect(tooSimilar(media(hue), media(hue + 60)), `@${hue}`).toBe(false);
    }
  });

  it("never lets a neutral color compete", () => {
    expect(colorDistance({ neutral: true }, media(10))).toBe(Infinity);
  });

  it("finds the closest hue that reads apart from the others", () => {
    const others = [media(195), media(350), media(70)];
    const hue = nearestFreeHue(207, "media", others)!;
    expect(hue).toBeGreaterThan(207);
    expect(others.every((o) => !tooSimilar(media(hue), o))).toBe(true);
    expect(nearestFreeHue(100, "media", [])).toBe(100);
  });

  it("returns null when every hue is taken", () => {
    const everyTen = Array.from({ length: 36 }, (_, i) => media(i * 10));
    expect(nearestFreeHue(5, "media", everyTen)).toBeNull();
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

describe("describeColorChange", () => {
  it("shows hue and intensity changes", () => {
    expect(
      describeColorChange("Tenor", { hue: 195, intensity: "media" }, { hue: 210, intensity: "intensa" })
    ).toBe("Tenor: 195° → 210°, media → intensa");
    expect(
      describeColorChange("Tenor", { hue: 195, intensity: "media" }, { hue: 195, intensity: "suave" })
    ).toBe("Tenor: media → suave");
    expect(
      describeColorChange("Color principal", { hue: 300, intensity: "media" }, { hue: 45, intensity: "media" })
    ).toBe("Color principal: 300° → 45°");
  });

  it("shows neutral toggles", () => {
    expect(describeColorChange("Piano", { hue: 130, intensity: "media" }, { neutral: true })).toBe(
      "Piano: neutra"
    );
    expect(describeColorChange("Piano", { neutral: true }, { hue: 130, intensity: "suave" })).toBe(
      "Piano: 130°, suave"
    );
  });
});

describe("hueLabelRows", () => {
  it("keeps labels far apart on one row", () => {
    expect(hueLabelRows([{ hue: 20, label: "Voz 1" }, { hue: 200, label: "Voz 2" }], 600)).toEqual([0, 0]);
  });

  it("moves a label that would overlap to the next row", () => {
    const rows = hueLabelRows(
      [
        { hue: 350, label: "Voz 1" },
        { hue: 337, label: "Orfeo" },
        { hue: 120, label: "Bajo" }
      ],
      600
    );
    expect(rows[2]).toBe(0);
    expect(new Set([rows[0], rows[1]]).size).toBe(2);
  });

  it("reuses the first row once there's room again", () => {
    const rows = hueLabelRows(
      [
        { hue: 10, label: "Soprano" },
        { hue: 16, label: "Contralto" },
        { hue: 180, label: "Tenor" }
      ],
      600
    );
    expect(rows).toEqual([0, 1, 0]);
  });
});
