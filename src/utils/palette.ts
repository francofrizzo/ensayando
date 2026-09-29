// Hue-based color model ("Luz de sala", design/fundamentos/paleta.html).
//
// Collections and tracks only store a hue (0–359) and an intensity. Every
// color the UI paints is derived here: lightness is fixed per role and theme,
// chroma comes from the intensity. That keeps every hue legible in both themes
// (see palette.test.ts for the contrast sweep).
//
// Kept free of "@/" imports so scripts/ can use it too.
import { clampChroma } from "culori";

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

/** A whole hue in [0, 360). */
export const normalizeHue = (hue: number) => ((Math.round(hue) % 360) + 360) % 360;

const isIntensity = (value: unknown): value is Intensity =>
  value === "suave" || value === "normal" || value === "intensa";

/** Maps an OKLCH chroma to the closest intensity, or neutral. Same thresholds as the migration. */
export const chromaToSpec = (hue: number, chroma: number): ColorSpec => {
  if (chroma < 0.04) return { neutral: true };
  if (chroma <= 0.115) return { hue: normalizeHue(hue), intensity: "suave" };
  if (chroma <= 0.18) return { hue: normalizeHue(hue), intensity: "normal" };
  return { hue: normalizeHue(hue), intensity: "intensa" };
};

/** Validates a stored spec (track_colors values are jsonb, so trust nothing). */
export const toColorSpec = (value: unknown): ColorSpec | null => {
  if (value === null || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (obj.neutral === true) return { neutral: true };
  if (typeof obj.hue === "number" && Number.isFinite(obj.hue)) {
    return {
      hue: normalizeHue(obj.hue),
      intensity: isIntensity(obj.intensity) ? obj.intensity : "normal"
    };
  }
  return null;
};

/** Converts OKLab a/b to chroma and hue (degrees 0–360). */
const labToChromaHue = (a: number, b: number) => ({
  chroma: Math.sqrt(a * a + b * b),
  hue: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
});

/** sRGB hex (#rrggbb or #rgb) to OKLab chroma and hue. Same math as the SQL migration. */
const hexToChromaHue = (hex: string) => {
  const digits = hex.length === 4 ? [...hex.slice(1)].map((d) => d + d).join("") : hex.slice(1);
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = [0, 2, 4].map((i) => toLinear(parseInt(digits.slice(i, i + 2), 16))) as [
    number,
    number,
    number
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return labToChromaHue(
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  );
};

const NUM = "[0-9]*\\.?[0-9]+";
const OKLCH_RE = new RegExp(
  `^\\s*oklch\\(\\s*${NUM}%?\\s+(${NUM})\\s+(${NUM})(?:deg)?\\s*(?:/[^)]*)?\\)\\s*$`,
  "i"
);
const HEX_RE = /^\s*#([0-9a-f]{3}|[0-9a-f]{6})\s*$/i;
const RGB_RE =
  /^\s*rgba?\(\s*([0-9]{1,3})\s*[, ]\s*([0-9]{1,3})\s*[, ]\s*([0-9]{1,3})\s*(?:[,/]\s*[0-9.]+%?\s*)?\)\s*$/i;

const toHex = (channel: number) => Math.min(channel, 255).toString(16).padStart(2, "0");

/**
 * Parses a pre-migration color string (the formats the database used: oklch(),
 * hex and rgb()). Mirrors color_to_spec() in the hue migration, and is tested with
 * the same fixtures, so both agree. Returns null for anything else, including
 * malformed numbers.
 */
export const parseLegacyColor = (value: string): ColorSpec | null => {
  const oklchMatch = OKLCH_RE.exec(value);
  if (oklchMatch) {
    const chroma = Number(oklchMatch[1]);
    const hue = Number(oklchMatch[2]);
    return Number.isFinite(chroma) && Number.isFinite(hue) ? chromaToSpec(hue, chroma) : null;
  }
  if (HEX_RE.test(value)) {
    const { chroma, hue } = hexToChromaHue(value.trim().toLowerCase());
    return chromaToSpec(hue, chroma);
  }
  const rgbMatch = RGB_RE.exec(value);
  if (rgbMatch) {
    const hex = `#${[rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((c) => toHex(Number(c))).join("")}`;
    const { chroma, hue } = hexToChromaHue(hex);
    return chromaToSpec(hue, chroma);
  }
  return null;
};

export type PaletteSource = {
  hue: number;
  intensity: Intensity;
  track_colors: Record<string, unknown>;
};

export type CollectionPalette = {
  main: ColorSpec;
  tracks: Record<string, ColorSpec>;
};

/** Resolves a collection's palette; without a collection, the brand color. */
export const resolveCollectionPalette = (
  source: PaletteSource | null | undefined
): CollectionPalette => {
  if (!source) return { main: BRAND_SPEC, tracks: {} };
  const main: ColorSpec = {
    hue: normalizeHue(source.hue),
    intensity: isIntensity(source.intensity) ? source.intensity : "normal"
  };
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
