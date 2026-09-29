// Hue-based color model ("Luz de sala", design/fundamentos/paleta.html).
//
// Collections and tracks only store a hue (0–359) and an intensity. Every
// color the UI paints is derived here: lightness is fixed per role and theme,
// chroma comes from the intensity. That keeps every hue legible in both themes
// (see palette.test.ts for the contrast sweep).
//
// Kept free of "@/" imports so scripts/ can use it too.
import { clampChroma, oklch, parse } from "culori";

export type Intensity = "suave" | "normal" | "intensa";
export type ColorSpec = { hue: number; intensity: Intensity } | { neutral: true };
export type ColorRole = "fill" | "ink" | "lyric" | "wave" | "soft" | "line";
export type Theme = "light" | "dark";

export const INTENSITY_CHROMA: Record<Intensity, number> = {
  suave: 0.08,
  normal: 0.15,
  intensa: 0.21
};

/** Hue used when there is no collection (login, home, errors): "violeta Ensayando". */
export const BRAND_SPEC: ColorSpec = { hue: 314, intensity: "normal" };

type RoleRule = { l: number; chroma: (c: number) => number };

// Values mirror design/shared/ds.css and design/shared/mock.css.
export const ROLE_RULES: Record<Theme, Record<ColorRole, RoleRule>> = {
  light: {
    fill: { l: 0.5, chroma: (c) => c },
    ink: { l: 0.47, chroma: (c) => Math.min(c, 0.4) },
    lyric: { l: 0.48, chroma: (c) => c },
    wave: { l: 0.59, chroma: (c) => c },
    soft: { l: 0.93, chroma: (c) => c * 0.3 },
    line: { l: 0.8, chroma: (c) => c * 0.5 }
  },
  dark: {
    fill: { l: 0.5, chroma: (c) => c },
    ink: { l: 0.8, chroma: (c) => Math.min(c, 0.17) },
    lyric: { l: 0.8, chroma: (c) => c },
    wave: { l: 0.7, chroma: (c) => c },
    soft: { l: 0.3, chroma: (c) => c * 0.45 },
    line: { l: 0.45, chroma: (c) => c * 0.6 }
  }
};

/** Theme canvas (page background), tinted with the collection hue. */
export const canvasColor = (theme: Theme, hue: number = BRAND_SPEC.hue) =>
  theme === "light" ? `oklch(0.974 0.006 ${hue})` : `oklch(0.155 0.012 ${hue})`;

export const isNeutral = (spec: ColorSpec): spec is { neutral: true } =>
  "neutral" in spec && spec.neutral === true;

export const specChroma = (spec: ColorSpec) =>
  isNeutral(spec) ? 0 : INTENSITY_CHROMA[spec.intensity];

export const specHue = (spec: ColorSpec) => (isNeutral(spec) ? 0 : spec.hue);

const round = (n: number, digits: number) => Number(n.toFixed(digits));

/**
 * Derives the CSS color for a role in a theme. Chroma is reduced to fit sRGB,
 * so every browser paints the same color.
 */
export const deriveColor = (
  spec: ColorSpec,
  role: ColorRole,
  theme: Theme,
  alpha?: number
): string => {
  const rule = ROLE_RULES[theme][role];
  const color = clampChroma(
    { mode: "oklch", l: rule.l, c: rule.chroma(specChroma(spec)), h: specHue(spec) },
    "oklch"
  );
  const l = round(color.l, 4);
  const c = round(color.c ?? 0, 4);
  const h = round(color.h ?? 0, 2);
  return alpha === undefined ? `oklch(${l} ${c} ${h})` : `oklch(${l} ${c} ${h} / ${alpha})`;
};

// ---------- legacy values ----------

const normalizeHue = (hue: number) => ((Math.round(hue) % 360) + 360) % 360;

const isIntensity = (value: unknown): value is Intensity =>
  value === "suave" || value === "normal" || value === "intensa";

/** Maps an OKLCH chroma to the closest intensity, or neutral. Same thresholds as the migration. */
export const chromaToSpec = (hue: number, chroma: number): ColorSpec => {
  if (chroma < 0.04) return { neutral: true };
  if (chroma <= 0.115) return { hue: normalizeHue(hue), intensity: "suave" };
  if (chroma <= 0.18) return { hue: normalizeHue(hue), intensity: "normal" };
  return { hue: normalizeHue(hue), intensity: "intensa" };
};

/**
 * Accepts a stored value in any shape: the new `{hue, intensity}` / `{neutral}`
 * objects, or a legacy CSS color string (hex, oklch, named…).
 */
export const toColorSpec = (value: unknown): ColorSpec | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.neutral === true) return { neutral: true };
    if (typeof obj.hue === "number" && Number.isFinite(obj.hue)) {
      return {
        hue: normalizeHue(obj.hue),
        intensity: isIntensity(obj.intensity) ? obj.intensity : "normal"
      };
    }
    return null;
  }
  if (typeof value !== "string") return null;
  const parsed = parse(value.trim());
  if (!parsed) return null;
  const color = oklch(parsed);
  if (!color) return null;
  return chromaToSpec(color.h ?? 0, color.c ?? 0);
};

export type PaletteSource = {
  hue?: number | null;
  intensity?: string | null;
  main_color?: string | null;
  track_colors?: Record<string, unknown> | null;
};

export type CollectionPalette = {
  main: ColorSpec;
  tracks: Record<string, ColorSpec>;
};

/** Resolves a collection's palette, preferring the new fields and falling back to legacy strings. */
export const resolveCollectionPalette = (source: PaletteSource | null | undefined): CollectionPalette => {
  if (!source) return { main: BRAND_SPEC, tracks: {} };
  let main: ColorSpec | null = null;
  if (typeof source.hue === "number") {
    main = {
      hue: normalizeHue(source.hue),
      intensity: isIntensity(source.intensity) ? source.intensity : "normal"
    };
  }
  main = main ?? toColorSpec(source.main_color) ?? BRAND_SPEC;
  const tracks: Record<string, ColorSpec> = {};
  for (const [key, value] of Object.entries(source.track_colors ?? {})) {
    const spec = toColorSpec(value);
    if (spec) tracks[key] = spec;
  }
  return { main, tracks };
};

/** CSS custom properties that drive the DaisyUI theme (see styles.css). */
export const collectionThemeVars = (spec: ColorSpec) => ({
  "--collection-hue": String(specHue(spec)),
  "--collection-chroma": String(specChroma(spec))
});

