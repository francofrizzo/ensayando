import { differenceEuclidean, displayable, oklch, wcagContrast } from "culori";
import { describe, expect, it } from "vitest";

import {
  BRAND_SPEC,
  canvasColor,
  chromaToSpec,
  collectionThemeVars,
  deriveColor,
  INTENSITY_RULES,
  legacyMaxChroma,
  maxChroma,
  ROLE_RULES,
  roleLightness,
  type ColorRole,
  type ColorSpec,
  type Intensity,
  resolveCollectionPalette,
  type Theme,
  parseLegacyColor,
  toColorSpec
} from "@/utils/palette";

import legacyColors from "@/__fixtures__/legacy-colors.json";

const THEMES: Theme[] = ["light", "dark"];
/** Panel background (DaisyUI base-100 in styles.css). */
const surfaceColor = (theme: Theme, hue: number) =>
  theme === "light" ? `oklch(0.994 0.003 ${hue})` : `oklch(0.2 0.014 ${hue})`;
const deltaEOK = differenceEuclidean("oklab");

/** Track colors of the production collection before the redesign (dark mode). */
const PREVIOUS_APP_COLORS = [
  { name: "Pista", hex: "#6363f0" },
  { name: "Solistas", hex: "#f5c518" },
  { name: "Voz 1", hex: "#e54a98" },
  { name: "Voz 2", hex: "#f07818" },
  { name: "Voz 3", hex: "#8ecb28" },
  { name: "Voz 4", hex: "#3db3d8" }
];
const INTENSITIES: Intensity[] = ["suave", "media", "intensa"];

describe("deriveColor", () => {
  it("follows each hue's cusp within the role's contrast-safe range", () => {
    const L = (hue: number, role: ColorRole, theme: Theme) =>
      Number(deriveColor({ hue, intensity: "media" }, role, theme).split(" ")[0]!.slice(6));
    // yellows sit high, blues low
    expect(L(95, "lyric", "dark")).toBeGreaterThan(L(265, "lyric", "dark") + 0.1);
    for (let hue = 0; hue < 360; hue += 5) {
      for (const theme of THEMES) {
        for (const role of ["fill", "ink", "lyric", "wave", "soft", "line"] as ColorRole[]) {
          const rule = ROLE_RULES[theme][role];
          const l = L(hue, role, theme);
          expect(l).toBeGreaterThanOrEqual(rule.min - 1e-3);
          expect(l).toBeLessThanOrEqual(rule.max + 1e-3);
        }
      }
    }
    // light-theme text stays dark enough to read on white (yellows turn ochre)
    expect(L(95, "lyric", "light")).toBeLessThanOrEqual(0.48);
  });

  it("gives each intensity a share of the hue's maximum chroma at the role's lightness", () => {
    for (const [hue, intensity] of [
      [195, "suave"],
      [195, "media"],
      [195, "intensa"],
      [60, "media"]
    ] as [number, Intensity][]) {
      const l = roleLightness("lyric", "dark", hue);
      const { share, cap } = INTENSITY_RULES[intensity];
      const c = Number(deriveColor({ hue, intensity }, "lyric", "dark").split(" ")[1]);
      expect(c).toBeCloseTo(Math.min(cap, share * maxChroma(l, hue)), 3);
    }
  });

  it("gives reds more chroma than the old fixed 0.15 at intensa", () => {
    for (const hue of [0, 15, 25, 30, 345]) {
      for (const role of ["fill", "lyric"] as ColorRole[]) {
        const c = Number(deriveColor({ hue, intensity: "intensa" }, role, "light").split(" ")[1]);
        expect(c).toBeGreaterThan(0.16);
      }
    }
  });

  it("keeps the three intensities clearly apart", () => {
    // media reads calmer than intensa, and suave calmer than media, for every hue
    for (let hue = 0; hue < 360; hue += 5) {
      for (const theme of THEMES) {
        const [s, m, i] = INTENSITIES.map((intensity) =>
          Number(deriveColor({ hue, intensity }, "wave", theme).split(" ")[1])
        );
        expect(m! / i!, `media/intensa @${hue} ${theme}`).toBeLessThanOrEqual(0.8);
        expect(s! / m!, `suave/media @${hue} ${theme}`).toBeLessThanOrEqual(0.7);
      }
    }
  });

  it("caps chroma per intensity so violets don't go neon", () => {
    for (let hue = 0; hue < 360; hue += 5) {
      for (const intensity of INTENSITIES) {
        const c = Number(deriveColor({ hue, intensity }, "fill", "light").split(" ")[1]);
        expect(c).toBeLessThanOrEqual(INTENSITY_RULES[intensity].cap + 1e-4);
      }
    }
  });

  it("orders intensities for every hue", () => {
    for (let hue = 0; hue < 360; hue += 5) {
      const [s, n, i] = INTENSITIES.map((intensity) =>
        Number(deriveColor({ hue, intensity }, "lyric", "light").split(" ")[1])
      );
      expect(s).toBeLessThan(n!);
      expect(n).toBeLessThanOrEqual(i!);
    }
  });

  it("matches the colors the app used before, for intensa in dark", () => {
    // Track colors of the production collection before the redesign (hex, dark
    // mode). Lightness follows the hue's cusp, so these land close; yellow and
    // lime are the hardest pair (adjacent hues that wanted opposite shifts).
    const report: string[] = [];
    let total = 0;
    for (const { name, hex } of PREVIOUS_APP_COLORS) {
      const hue = oklch(hex)!.h!;
      for (const role of ["lyric", "wave"] as ColorRole[]) {
        const d = deltaEOK(deriveColor({ hue, intensity: "intensa" }, role, "dark"), hex) * 100;
        total += d;
        report.push(`${name} ${role} ΔE ${d.toFixed(1)}`);
        expect(d, report.join(" · ")).toBeLessThan(5.5);
      }
    }
    expect(total / (PREVIOUS_APP_COLORS.length * 2)).toBeLessThan(3.2);
  });

  it("caps collection ink chroma in dark", () => {
    const color = deriveColor({ hue: 300, intensity: "intensa" }, "ink", "dark");
    const chroma = Number(color.split(" ")[1]);
    expect(chroma).toBeLessThanOrEqual(0.17);
  });

  it("paints neutral specs without chroma", () => {
    expect(deriveColor({ neutral: true }, "lyric", "dark")).toBe("oklch(0.73 0 0)");
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
          // ink is also the text of selected items, badges and tabs on tinted
          // (soft) backgrounds, and of links on panels (surface)
          check("ink on soft", deriveColor(spec, "ink", theme), deriveColor(spec, "soft", theme), 4.5);
          check("ink on surface", deriveColor(spec, "ink", theme), surfaceColor(theme, hue), 4.5);
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
    expect(toColorSpec({ hue: 195, intensity: "media" })).toEqual({
      hue: 195,
      intensity: "media"
    });
    expect(toColorSpec({ hue: 370 })).toEqual({ hue: 10, intensity: "media" });
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

  it("maps by chroma relative to the hue's maximum at that lightness", () => {
    expect(chromaToSpec(0.6, 10, 0.039)).toEqual({ neutral: true });
    const max = legacyMaxChroma(0.6, 10);
    expect(chromaToSpec(0.6, 10, max * 0.44)).toEqual({ hue: 10, intensity: "suave" });
    expect(chromaToSpec(0.6, 10, max * 0.46)).toEqual({ hue: 10, intensity: "media" });
    expect(chromaToSpec(0.6, 10, max * 0.73)).toEqual({ hue: 10, intensity: "intensa" });
  });

  it("maps the colors the app used before the redesign to intensa", () => {
    for (const { hex } of PREVIOUS_APP_COLORS) {
      expect(parseLegacyColor(hex)).toMatchObject({ intensity: "intensa" });
    }
  });
});

describe("resolveCollectionPalette", () => {
  it("reads hue, intensity and track specs", () => {
    const palette = resolveCollectionPalette({
      hue: 45,
      intensity: "suave",
      track_colors: { a: { hue: 10, intensity: "media" }, c: { neutral: true }, broken: "#fff" }
    });
    expect(palette.main).toEqual({ hue: 45, intensity: "suave" });
    expect(palette.tracks.a).toEqual({ hue: 10, intensity: "media" });
    expect(palette.tracks.c).toEqual({ neutral: true });
    expect(palette.tracks.broken).toBeUndefined();
  });

  it("falls back to the brand without a collection", () => {
    expect(resolveCollectionPalette(null).main).toEqual(BRAND_SPEC);
  });
});

describe("maxChroma", () => {
  it("finds the sRGB edge for a hue and lightness", () => {
    for (const [l, h] of [
      [0.5, 25],
      [0.5, 195],
      [0.8, 25],
      [0.48, 285]
    ] as const) {
      const c = maxChroma(l, h);
      expect(displayable({ mode: "oklch", l, c, h })).toBe(true);
      expect(displayable({ mode: "oklch", l, c: c + 0.005, h })).toBe(false);
    }
  });
});

describe("collectionThemeVars", () => {
  it("exposes the hue and the derived colors per theme", () => {
    const spec: ColorSpec = { hue: 48, intensity: "intensa" };
    expect(collectionThemeVars(spec)).toEqual({
      "--collection-hue": "48",
      "--collection-fill": deriveColor(spec, "fill", "light"),
      "--collection-ink-light": deriveColor(spec, "ink", "light"),
      "--collection-ink-dark": deriveColor(spec, "ink", "dark"),
      "--collection-soft-light": deriveColor(spec, "soft", "light"),
      "--collection-soft-dark": deriveColor(spec, "soft", "dark")
    });
    expect(collectionThemeVars({ neutral: true })["--collection-fill"]).toBe("oklch(0.46 0 0)");
  });

  it("matches the brand defaults in styles.css", () => {
    expect(collectionThemeVars(BRAND_SPEC)).toMatchObject({
      "--collection-fill": "oklch(0.429 0.2 314)",
      "--collection-ink-light": "oklch(0.429 0.2 314)",
      "--collection-ink-dark": "oklch(0.76 0.17 314)",
      "--collection-soft-light": "oklch(0.93 0.0481 314)",
      "--collection-soft-dark": "oklch(0.3 0.09 314)"
    });
  });
});
