import { beforeAll, describe, expect, it } from "vitest";

import { applyThemeMode, THEME_STORAGE_KEY, useTheme } from "@/composables/useTheme";

// Node's own experimental localStorage global shadows happy-dom's and is unusable
// without a backing file, so give the test a plain in-memory storage.
beforeAll(() => {
  const items = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key)
    }
  });
});

describe("useTheme", () => {
  it("applies explicit modes as data-theme and clears it for system", () => {
    const root = document.createElement("html");
    applyThemeMode("dark", root);
    expect(root.getAttribute("data-theme")).toBe("dark");
    applyThemeMode("system", root);
    expect(root.hasAttribute("data-theme")).toBe(false);
  });

  it("persists the chosen mode and resolves it", () => {
    const { mode, resolvedTheme, setMode } = useTheme();
    setMode("dark");
    expect(mode.value).toBe("dark");
    expect(resolvedTheme.value).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    setMode("light");
    expect(resolvedTheme.value).toBe("light");
    setMode("system");
  });
});
