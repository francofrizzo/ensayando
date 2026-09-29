import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyReactionOffset,
  clampReactionOffset,
  DEFAULT_REACTION_OFFSET,
  REACTION_OFFSET_STORAGE_KEY
} from "./useReactionOffset";

// Node's own experimental localStorage global shadows happy-dom's and is unusable
// without a backing file, so give the test a plain in-memory storage.
const items = new Map<string, string>();
beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
      clear: () => items.clear()
    }
  });
});

describe("clampReactionOffset", () => {
  it("keeps the value between 0 and 1 s, rounded to hundredths", () => {
    expect(clampReactionOffset(0.234)).toBe(0.23);
    expect(clampReactionOffset(-0.5)).toBe(0);
    expect(clampReactionOffset(3)).toBe(1);
  });

  it("falls back to the default for non-numbers", () => {
    expect(clampReactionOffset(Number.NaN)).toBe(DEFAULT_REACTION_OFFSET);
  });
});

describe("applyReactionOffset", () => {
  it("subtracts the correction and never goes below zero", () => {
    expect(applyReactionOffset(12.5, 0.2)).toBe(12.3);
    expect(applyReactionOffset(0.1, 0.2)).toBe(0);
  });
});

describe("useReactionOffset", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it("reads the stored value and persists changes", async () => {
    window.localStorage.setItem(REACTION_OFFSET_STORAGE_KEY, "0.35");
    const { useReactionOffset } = await import("./useReactionOffset");
    const { offset, setOffset, nudge, apply } = useReactionOffset();
    expect(offset.value).toBe(0.35);

    setOffset(0.5);
    expect(window.localStorage.getItem(REACTION_OFFSET_STORAGE_KEY)).toBe("0.5");

    nudge(-1);
    expect(offset.value).toBe(0.45);
    expect(apply(10)).toBe(9.55);
  });

  it("uses the default when nothing is stored", async () => {
    const { useReactionOffset } = await import("./useReactionOffset");
    expect(useReactionOffset().offset.value).toBe(DEFAULT_REACTION_OFFSET);
  });
});
