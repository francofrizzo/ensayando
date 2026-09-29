import { computed, ref, watch } from "vue";

import type { Theme } from "@/utils/palette";

export type ThemeMode = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "ens-theme";

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "system" || value === "light" || value === "dark";

const readStoredMode = (): ThemeMode => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
};

const darkQuery =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

// Module-level state: one theme for the whole app.
const mode = ref<ThemeMode>(readStoredMode());
const systemDark = ref(darkQuery?.matches ?? false);
darkQuery?.addEventListener("change", (event) => {
  systemDark.value = event.matches;
});

const resolvedTheme = computed<Theme>(() => {
  if (mode.value === "system") return systemDark.value ? "dark" : "light";
  return mode.value;
});

/** "system" leaves the attribute off so DaisyUI follows prefers-color-scheme. */
export const applyThemeMode = (value: ThemeMode, root: HTMLElement = document.documentElement) => {
  if (value === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", value);
};

watch(mode, (value) => applyThemeMode(value), { immediate: typeof document !== "undefined" });

const setMode = (value: ThemeMode) => {
  mode.value = value;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for the session.
  }
};

export function useTheme() {
  return {
    mode: computed(() => mode.value),
    resolvedTheme,
    setMode
  };
}
