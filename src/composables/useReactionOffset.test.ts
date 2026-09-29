import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const items = new Map<string, string>();

// Node's experimental localStorage shadows happy-dom's (see useTheme.test.ts).
beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key)
    }
  });
});

describe("useReactionOffset", () => {
  beforeEach(() => {
    items.clear();
    vi.resetModules();
  });

  it("defaults to 0.2 s", async () => {
    const { useReactionOffset } = await import("./useReactionOffset");
    expect(useReactionOffset().value).toBe(0.2);
  });

  it("persists changes on the device", async () => {
    const { useReactionOffset, REACTION_OFFSET_KEY } = await import("./useReactionOffset");
    useReactionOffset().value = 0.35;
    await nextTick();
    expect(window.localStorage.getItem(REACTION_OFFSET_KEY)).toBe("0.35");
  });

  it("reads a stored value, clamped to 0–1", async () => {
    window.localStorage.setItem("ens-reaction-offset", "3");
    const { useReactionOffset } = await import("./useReactionOffset");
    expect(useReactionOffset().value).toBe(1);
  });

  it("shares one value between callers", async () => {
    const { useReactionOffset } = await import("./useReactionOffset");
    useReactionOffset().value = 0.1;
    expect(useReactionOffset().value).toBe(0.1);
  });
});
