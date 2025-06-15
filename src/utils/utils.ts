import { clampChroma, formatCss, lch, wcagContrast } from "culori";

export const formatTime = (time: number): string => {
  const [minutes, seconds] = [Math.floor(time / 60), Math.floor(time % 60)];
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const darken = (colorStr: string, amount: number) => {
  const colorLch = lch(colorStr);
  if (!colorLch) return colorStr;
  return formatCss(clampChroma({ ...colorLch, l: Math.max(0, colorLch.l - amount * 100) }));
};

export const lighten = (colorStr: string, amount: number) => {
  const colorLch = lch(colorStr);
  if (!colorLch) return colorStr;
  return formatCss(clampChroma({ ...colorLch, l: Math.min(100, colorLch.l + amount * 100) }));
};

export const transparentize = (colorStr: string, amount: number) => {
  const colorLch = lch(colorStr);
  if (!colorLch) return colorStr;
  const currentAlpha = colorLch.alpha ?? 1;
  return formatCss(clampChroma({ ...colorLch, alpha: Math.max(0, currentAlpha - amount) }));
};

export const selectMostContrasting = (colorStr: string, choicesStr: string[]) => {
  let color: string | undefined;
  const contrast = -Infinity;
  for (const choice of choicesStr) {
    if (wcagContrast(colorStr, choice) > contrast) {
      color = choice;
    }
  }
  return color;
};
