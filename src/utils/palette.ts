// Hue-based color model ("Luz de sala", design/fundamentos/paleta.html).
//
// Collections and tracks only store a hue (0–359) and an intensity. Every
// color the UI paints is derived here, per role (fill, lyric ink, wave…) and
// theme:
//   - Lightness follows the hue: each hue shows the most color near its gamut
//     cusp (yellows high, blues low), so L tracks the cusp, clamped to a range
//     that keeps the role legible in that theme. Light-theme text stays dark
//     (yellows turn ochre there: that's physics).
//   - Chroma is a share of the most that hue can show in sRGB at that lightness,
//     capped per intensity. A fixed chroma left reds and magentas dull next to
//     cyans, which were already clipped.
// See palette.test.ts for the contrast sweep and the fit against the colors the
// app used before the redesign.
// Kept free of "@/" imports so scripts/ can use it too.
import { clampChroma, displayable } from "culori";

export type Intensity = "suave" | "normal" | "intensa";
export type ColorSpec = { hue: number; intensity: Intensity } | { neutral: true };
export type ColorRole = "fill" | "ink" | "lyric" | "wave" | "soft" | "line";
export type Theme = "light" | "dark";

/**
 * Intensity = share of the hue's maximum sRGB chroma at the role's lightness,
 * with an absolute cap so violets and pinks (which reach ~0.29) don't go neon.
 */
export const INTENSITY_RULES: Record<Intensity, { share: number; cap: number }> = {
  suave: { share: 0.5, cap: 0.1 },
  normal: { share: 0.95, cap: 0.18 },
  intensa: { share: 1, cap: 0.2 }
};

const maxChromaCache = new Map<string, number>();

/** Largest chroma displayable in sRGB at lightness `l` and hue `h` (binary search, memoized). */
export const maxChroma = (l: number, h: number): number => {
  const hue = Math.round(h) % 360;
  const key = `${l}|${hue}`;
  const cached = maxChromaCache.get(key);
  if (cached !== undefined) return cached;
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (displayable({ mode: "oklch", l, c: mid, h: hue })) lo = mid;
    else hi = mid;
  }
  maxChromaCache.set(key, lo);
  return lo;
};

const cuspCache = new Map<number, number>();

/** Lightness at which a hue reaches its largest sRGB chroma (its gamut cusp). */
export const cuspLightness = (h: number): number => {
  const hue = ((Math.round(h) % 360) + 360) % 360;
  const cached = cuspCache.get(hue);
  if (cached !== undefined) return cached;
  let best = 0.5;
  let bestC = -1;
  for (let l = 0.3; l <= 0.99; l += 0.01) {
    const c = maxChroma(Number(l.toFixed(2)), hue);
    if (c > bestC) {
      bestC = c;
      best = l;
    }
  }
  // refine around the coarse maximum
  for (let l = best - 0.01; l <= best + 0.01; l += 0.002) {
    const c = maxChroma(Number(l.toFixed(3)), hue);
    if (c > bestC) {
      bestC = c;
      best = l;
    }
  }
  const result = Number(best.toFixed(3));
  cuspCache.set(hue, result);
  return result;
};

/**
 * Natural lightness for a hue: follows its cusp, fitted to the colors the app
 * used before the redesign (so "intensa" in dark matches them closely).
 */
export const HUE_LIGHTNESS = { base: 0.23, slope: 0.65 };
export const naturalLightness = (h: number) =>
  HUE_LIGHTNESS.base + HUE_LIGHTNESS.slope * cuspLightness(h);

/** Hue used when there is no collection (login, home, errors): "violeta Ensayando". */
export const BRAND_SPEC: ColorSpec = { hue: 314, intensity: "normal" };

// Lightness = clamp(naturalLightness(hue) + offset, min, max). A role with
// min === max has a fixed lightness (backgrounds, borders). The bounds are the
// contrast-safe range for the role in that theme (see the sweep in the tests).
// Tinted backgrounds and borders take a fraction of the fill's chroma rather
// than their own maximum (`fromFill`).
type RoleRule = {
  offset: number;
  min: number;
  max: number;
  fromFill?: boolean;
  chroma: (c: number) => number;
};

// Values mirror design/shared/ds.css and design/shared/mock.css.
export const ROLE_RULES: Record<Theme, Record<ColorRole, RoleRule>> = {
  light: {
    fill: { offset: -0.2, min: 0.42, max: 0.5, chroma: (c) => c },
    ink: { offset: -0.2, min: 0.4, max: 0.47, chroma: (c) => Math.min(c, 0.4) },
    lyric: { offset: -0.2, min: 0.4, max: 0.48, chroma: (c) => c },
    wave: { offset: -0.1, min: 0.5, max: 0.59, chroma: (c) => c },
    soft: { offset: 0, min: 0.93, max: 0.93, fromFill: true, chroma: (c) => c * 0.3 },
    line: { offset: 0, min: 0.8, max: 0.8, fromFill: true, chroma: (c) => c * 0.5 }
  },
  dark: {
    fill: { offset: -0.2, min: 0.42, max: 0.5, chroma: (c) => c },
    ink: { offset: 0, min: 0.6, max: 0.86, chroma: (c) => Math.min(c, 0.17) },
    lyric: { offset: 0, min: 0.6, max: 0.86, chroma: (c) => c },
    wave: { offset: 0, min: 0.6, max: 0.86, chroma: (c) => c },
    soft: { offset: 0, min: 0.3, max: 0.3, fromFill: true, chroma: (c) => c * 0.45 },
    line: { offset: 0, min: 0.45, max: 0.45, fromFill: true, chroma: (c) => c * 0.6 }
  }
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Lightness of a role for a hue in a theme; `null` (neutral) takes the middle of the range. */
export const roleLightness = (role: ColorRole, theme: Theme, hue: number | null) => {
  const rule = ROLE_RULES[theme][role];
  if (rule.min === rule.max) return rule.min;
  if (hue === null) return Number(((rule.min + rule.max) / 2).toFixed(3));
  return Number(clamp(naturalLightness(hue) + rule.offset, rule.min, rule.max).toFixed(3));
};

/** Theme canvas (page background), tinted with the collection hue. */
export const canvasColor = (theme: Theme, hue: number = BRAND_SPEC.hue) =>
  theme === "light" ? `oklch(0.974 0.006 ${hue})` : `oklch(0.155 0.012 ${hue})`;

export const isNeutral = (spec: ColorSpec): spec is { neutral: true } =>
  "neutral" in spec && spec.neutral === true;

/** Chroma a spec takes at lightness `l`: its intensity's share of that hue's maximum, capped. */
export const specChroma = (spec: ColorSpec, l: number) => {
  if (isNeutral(spec)) return 0;
  const { share, cap } = INTENSITY_RULES[spec.intensity];
  return Math.min(cap, share * maxChroma(l, spec.hue));
};

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
  const hue = specHue(spec);
  const lightHue = isNeutral(spec) ? null : hue;
  const l = roleLightness(role, theme, lightHue);
  const chromaL = rule.fromFill ? roleLightness("fill", theme, lightHue) : l;
  const color = clampChroma(
    { mode: "oklch", l, c: rule.chroma(specChroma(spec, chromaL)), h: hue },
    "oklch"
  );
  const outL = round(color.l, 4);
  const c = round(color.c ?? 0, 4);
  const h = round(color.h ?? hue, 2);
  return alpha === undefined
    ? `oklch(${outL} ${c} ${h})`
    : `oklch(${outL} ${c} ${h} / ${alpha})`;
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

/** A spec's color at an arbitrary lightness (generated banners, glows). */
export const colorAt = (spec: ColorSpec, l: number, hueShift = 0) => {
  const h = (specHue(spec) + hueShift + 360) % 360;
  const shifted: ColorSpec = isNeutral(spec) ? spec : { ...spec, hue: h };
  const c = round(specChroma(shifted, l), 4);
  return `oklch(${l} ${c} ${round(h, 2)})`;
};

/**
 * CSS custom properties that drive the DaisyUI theme (see styles.css). Chroma
 * depends on hue and lightness, so the final colors are computed here; CSS only
 * picks the light or dark variant.
 */
export const collectionThemeVars = (spec: ColorSpec) => ({
  "--collection-hue": String(specHue(spec)),
  "--collection-fill": deriveColor(spec, "fill", "light"),
  "--collection-ink-light": deriveColor(spec, "ink", "light"),
  "--collection-ink-dark": deriveColor(spec, "ink", "dark"),
  "--collection-soft-light": deriveColor(spec, "soft", "light"),
  "--collection-soft-dark": deriveColor(spec, "soft", "dark")
});
