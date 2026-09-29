import { oklch, wcagContrast } from "culori";
import { describe, expect, it } from "vitest";

import {
  BRAND_SPEC,
  canvasColor,
  chromaToSpec,
  collectionThemeVars,
  deriveColor,
  type ColorSpec,
  type Intensity,
  resolveCollectionPalette,
  type Theme,
  parseLegacyColor,
  toColorSpec
} from "@/utils/palette";

import legacyColors from "@/__fixtures__/legacy-colors.json";

const THEMES: Theme[] = ["light", "dark"];
const INTENSITIES: Intensity[] = ["suave", "normal", "intensa"];

describe("deriveColor", () => {
  it("uses fixed lightness per role and theme", () => {
    const spec: ColorSpec = { hue: 300, intensity: "normal" };
    expect(deriveColor(spec, "fill", "light")).toMatch(/^oklch\(0\.5 /);
    expect(deriveColor(spec, "lyric", "light")).toMatch(/^oklch\(0\.48 /);
    expect(deriveColor(spec, "lyric", "dark")).toMatch(/^oklch\(0\.8 /);
    expect(deriveColor(spec, "wave", "light")).toMatch(/^oklch\(0\.59 /);
    expect(deriveColor(spec, "wave", "dark")).toMatch(/^oklch\(0\.7 /);
    expect(deriveColor(spec, "ink", "light")).toMatch(/^oklch\(0\.47 /);
  });

  it("keeps the hue and maps intensity to chroma", () => {
    expect(deriveColor({ hue: 300, intensity: "suave" }, "fill", "light")).toBe("oklch(0.5 0.08 300)");
    expect(deriveColor({ hue: 300, intensity: "normal" }, "fill", "light")).toBe("oklch(0.5 0.15 300)");
  });

  it("caps collection ink chroma in dark", () => {
    const color = deriveColor({ hue: 300, intensity: "intensa" }, "ink", "dark");
    const chroma = Number(color.split(" ")[1]);
    expect(chroma).toBeLessThanOrEqual(0.17);
  });

  it("paints neutral specs without chroma", () => {
    expect(deriveColor({ neutral: true }, "lyric", "dark")).toBe("oklch(0.8 0 0)");
  });

  it("appends alpha when given", () => {
    expect(deriveColor({ hue: 10, intensity: "suave" }, "fill", "dark", 0.2)).toMatch(/\/ 0\.2\)$/);
  });
});

describe("contrast sweep over every hue", () => {
  for (const theme of THEMES) {
    for (const intensity of INTENSITIES) {
      it(`${theme} · ${intensity}`, () => {
        const failures: string[] = [];
        for (let hue = 0; hue < 360; hue++) {
          const spec: ColorSpec = { hue, intensity };
          const canvas = canvasColor(theme, hue);
          const check = (label: string, fg: string, bg: string, min: number) => {
            const ratio = wcagContrast(fg, bg);
            if (ratio < min) failures.push(`${label} @${hue}: ${ratio.toFixed(2)}`);
          };
          check("lyric", deriveColor(spec, "lyric", theme), canvas, 4.5);
          check("ink", deriveColor(spec, "ink", theme), canvas, 4.5);
          check("white on fill", "white", deriveColor(spec, "fill", theme), 4.5);
          check("wave", deriveColor(spec, "wave", theme), canvas, 3);
        }
        expect(failures).toEqual([]);
      });
    }
  }
});

describe("toColorSpec", () => {
  it("reads stored specs", () => {
    expect(toColorSpec({ hue: 195, intensity: "normal" })).toEqual({ hue: 195, intensity: "normal" });
    expect(toColorSpec({ hue: 370 })).toEqual({ hue: 10, intensity: "normal" });
    expect(toColorSpec({ neutral: true })).toEqual({ neutral: true });
  });

  it("rejects anything else", () => {
    expect(toColorSpec(null)).toBeNull();
    expect(toColorSpec("#3b82f6")).toBeNull();
    expect(toColorSpec({ foo: 1 })).toBeNull();
  });
});

describe("parseLegacyColor", () => {
  // Same fixtures as the SQL conversion in the hue migration (tests/db/hue-migration.check.ts).
  for (const { input, expected } of legacyColors) {
    it(`${input} → ${JSON.stringify(expected)}`, () => {
      expect(parseLegacyColor(input)).toEqual(expected);
    });
  }

  it("agrees with culori on hex hues", () => {
    for (const hex of ["#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#eab308", "#14b8a6"]) {
      const spec = parseLegacyColor(hex) as { hue: number };
      expect(Math.abs(spec.hue - Math.round(oklch(hex)!.h!))).toBeLessThanOrEqual(1);
    }
  });

  it("uses the migration thresholds", () => {
    expect(chromaToSpec(10, 0.039)).toEqual({ neutral: true });
    expect(chromaToSpec(10, 0.115)).toEqual({ hue: 10, intensity: "suave" });
    expect(chromaToSpec(10, 0.18)).toEqual({ hue: 10, intensity: "normal" });
    expect(chromaToSpec(10, 0.181)).toEqual({ hue: 10, intensity: "intensa" });
  });
});

describe("resolveCollectionPalette", () => {
  it("reads hue, intensity and track specs", () => {
    const palette = resolveCollectionPalette({
      hue: 45,
      intensity: "suave",
      track_colors: { a: { hue: 10, intensity: "normal" }, c: { neutral: true }, broken: "#fff" }
    });
    expect(palette.main).toEqual({ hue: 45, intensity: "suave" });
    expect(palette.tracks.a).toEqual({ hue: 10, intensity: "normal" });
    expect(palette.tracks.c).toEqual({ neutral: true });
    expect(palette.tracks.broken).toBeUndefined();
  });

  it("falls back to the brand without a collection", () => {
    expect(resolveCollectionPalette(null).main).toEqual(BRAND_SPEC);
  });
});

describe("collectionThemeVars", () => {
  it("exposes hue and chroma", () => {
    expect(collectionThemeVars({ hue: 48, intensity: "intensa" })).toEqual({
      "--collection-hue": "48",
      "--collection-chroma": "0.21"
    });
    expect(collectionThemeVars({ neutral: true })).toEqual({
      "--collection-hue": "0",
      "--collection-chroma": "0"
    });
  });
});
