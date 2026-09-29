import { wcagContrast } from "culori";
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
  toColorSpec
} from "@/utils/palette";

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
  it("reads the new object shapes", () => {
    expect(toColorSpec({ hue: 195, intensity: "normal" })).toEqual({ hue: 195, intensity: "normal" });
    expect(toColorSpec({ hue: 370 })).toEqual({ hue: 10, intensity: "normal" });
    expect(toColorSpec({ neutral: true })).toEqual({ neutral: true });
  });

  it("maps legacy OKLCH strings to hue and intensity", () => {
    expect(toColorSpec("oklch(60.6% 0.25 292.717)")).toEqual({ hue: 293, intensity: "intensa" });
    expect(toColorSpec("oklch(76.8% 0.233 130.85)")).toEqual({ hue: 131, intensity: "intensa" });
    expect(toColorSpec("oklch(0.72 0.13 190)")).toEqual({ hue: 190, intensity: "normal" });
    expect(toColorSpec("oklch(0.7 0.09 40)")).toEqual({ hue: 40, intensity: "suave" });
  });

  it("maps legacy hex strings", () => {
    const blue = toColorSpec("#3b82f6");
    expect(blue).toMatchObject({ intensity: "intensa" });
    expect((blue as { hue: number }).hue).toBeGreaterThan(255);
    expect((blue as { hue: number }).hue).toBeLessThan(265);
    expect(toColorSpec("#ef4444")).toMatchObject({ intensity: "intensa" });
  });

  it("treats low chroma as neutral", () => {
    expect(toColorSpec("#808080")).toEqual({ neutral: true });
    expect(toColorSpec("oklch(0.5 0.02 200)")).toEqual({ neutral: true });
  });

  it("returns null for unusable values", () => {
    expect(toColorSpec(null)).toBeNull();
    expect(toColorSpec("not a color")).toBeNull();
    expect(toColorSpec({ foo: 1 })).toBeNull();
  });

  it("uses the migration thresholds", () => {
    expect(chromaToSpec(10, 0.039)).toEqual({ neutral: true });
    expect(chromaToSpec(10, 0.115)).toEqual({ hue: 10, intensity: "suave" });
    expect(chromaToSpec(10, 0.18)).toEqual({ hue: 10, intensity: "normal" });
    expect(chromaToSpec(10, 0.181)).toEqual({ hue: 10, intensity: "intensa" });
  });
});

describe("resolveCollectionPalette", () => {
  it("prefers the new fields", () => {
    const palette = resolveCollectionPalette({
      hue: 45,
      intensity: "suave",
      main_color: "#3b82f6",
      track_colors: { a: { hue: 10, intensity: "normal" }, b: "#22c55e", c: { neutral: true } }
    });
    expect(palette.main).toEqual({ hue: 45, intensity: "suave" });
    expect(palette.tracks.a).toEqual({ hue: 10, intensity: "normal" });
    expect(palette.tracks.b).toMatchObject({ intensity: "intensa" });
    expect(palette.tracks.c).toEqual({ neutral: true });
  });

  it("falls back to the legacy main color, then to the brand", () => {
    expect(resolveCollectionPalette({ main_color: "oklch(0.55 0.15 150)" }).main).toEqual({
      hue: 150,
      intensity: "normal"
    });
    expect(resolveCollectionPalette({ main_color: "nope" }).main).toEqual(BRAND_SPEC);
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
