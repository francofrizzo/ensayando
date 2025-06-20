import { clampChroma, formatCss, lch, wcagContrast } from "culori";

export const formatTime = (time: number): string => {
  const [minutes, seconds] = [Math.floor(time / 60), Math.floor(time % 60)];
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const darken = (colorStr: string, amount: number) => {
  const colorLch = lch(colorStr);
  if (!colorLch) return colorStr;

  const newL = Math.max(0, colorLch.l * (1 - amount));
  return formatCss(clampChroma({ ...colorLch, l: newL }));
};

export const lighten = (colorStr: string, amount: number) => {
  const colorLch = lch(colorStr);
  if (!colorLch) return colorStr;

  const newL = Math.min(100, colorLch.l + (100 - colorLch.l) * amount);
  return formatCss(clampChroma({ ...colorLch, l: newL }));
};

export const transparentize = (colorStr: string, amount: number) => {
  const colorLch = lch(colorStr);
  if (!colorLch) return colorStr;
  const currentAlpha = colorLch.alpha ?? 1;
  return formatCss(clampChroma({ ...colorLch, alpha: Math.max(0, currentAlpha - amount) }));
};

export const selectMostContrasting = (colorStr: string, choicesStr: string[]) => {
  let color: string | undefined;
  let maxContrast = -Infinity;
  for (const choice of choicesStr) {
    const contrast = wcagContrast(colorStr, choice);
    if (contrast > maxContrast) {
      color = choice;
      maxContrast = contrast;
    }
  }
  return color;
};
