import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";

import type { CollectionWithRole } from "@/data/types";

import { useCollectionTheme } from "./useCollectionTheme";

const collection = (id: number, hue: number): CollectionWithRole =>
  ({
    id,
    slug: `c${id}`,
    title: `C${id}`,
    hue,
    intensity: "media",
    track_colors: {},
    visibility: "private",
    created_at: "",
    user_role: "admin"
  }) as unknown as CollectionWithRole;

const Screen = (value: CollectionWithRole) =>
  defineComponent({
    setup() {
      useCollectionTheme(ref(value));
      return () => h("div");
    }
  });

const hue = () => document.documentElement.style.getPropertyValue("--collection-hue");

afterEach(() => document.documentElement.removeAttribute("style"));

describe("useCollectionTheme", () => {
  it("paints the collection's hue on <html> and clears it on unmount", () => {
    const screen = mount(Screen(collection(1, 45)));
    expect(hue()).toBe("45");
    screen.unmount();
    expect(hue()).toBe("");
  });

  it("a screen that unmounts late doesn't wipe the next screen's colors", () => {
    const leaving = mount(Screen(collection(1, 300)));
    const arriving = mount(Screen(collection(2, 45)));
    leaving.unmount();
    expect(hue()).toBe("45");
    arriving.unmount();
    expect(hue()).toBe("");
  });
});
