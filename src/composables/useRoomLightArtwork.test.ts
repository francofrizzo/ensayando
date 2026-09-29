import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

import { useRoomLightArtwork } from "./useRoomLightArtwork";

// Node's experimental localStorage shadows happy-dom's (see useTheme.test.ts).
const items = new Map<string, string>();
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

describe("useRoomLightArtwork", () => {
  beforeEach(() => items.clear());

  it("defaults to on and remembers the choice per collection", async () => {
    const id = ref<number | null>(7);
    const { useArtwork } = useRoomLightArtwork(id);
    expect(useArtwork.value).toBe(true);

    useArtwork.value = false;
    expect(window.localStorage.getItem("ens-room-artwork-7")).toBe("off");

    id.value = 8;
    await nextTick();
    expect(useArtwork.value).toBe(true);

    id.value = 7;
    await nextTick();
    expect(useArtwork.value).toBe(false);
  });

  it("keeps other instances in sync", async () => {
    const a = useRoomLightArtwork(ref(3));
    const b = useRoomLightArtwork(ref(3));
    a.useArtwork.value = false;
    await nextTick();
    expect(b.useArtwork.value).toBe(false);
  });
});
