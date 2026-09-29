import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

import {
  type EditorSession,
  isEditorTabId,
  provideEditorSession,
  savedLabel
} from "@/composables/useEditorSession";

vi.mock("vue-router", () => ({ useRoute: () => ({ params: {} }) }));
vi.mock("@/data/supabase", () => ({ updateSongLyrics: vi.fn(async () => ({ error: null })) }));

const setup = () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  let session!: EditorSession;
  mount(
    defineComponent({
      setup() {
        session = provideEditorSession();
        return () => h("div");
      }
    }),
    { global: { plugins: [pinia] } }
  );
  return session;
};

describe("isEditorTabId", () => {
  it("accepts the three tabs only", () => {
    expect(["cancion", "letra", "sincronizar"].every(isEditorTabId)).toBe(true);
    expect(isEditorTabId("json")).toBe(false);
    expect(isEditorTabId(undefined)).toBe(false);
  });
});

describe("savedLabel", () => {
  it("says 'hace un momento' for the first minute, then the time", () => {
    const at = new Date(2026, 8, 29, 21, 4).getTime();
    expect(savedLabel(null, at)).toBeNull();
    expect(savedLabel(at, at + 30_000)).toBe("Guardado hace un momento");
    expect(savedLabel(at, at + 120_000)).toMatch(/^Guardado a las 21:04/);
  });
});

describe("editor session", () => {
  it("is clean until a registered part is dirty, and marks its tab", () => {
    const session = setup();
    const dirty = ref(false);
    session.register("cancion", {
      isDirty: () => dirty.value,
      save: async () => {},
      discard: () => {}
    });
    expect(session.isDirty.value).toBe(false);
    dirty.value = true;
    expect(session.isDirty.value).toBe(true);
    expect(session.dirtyByTab.value).toEqual({ cancion: true, letra: false, sincronizar: false });
  });

  it("saves the song form before anything else and records the time", async () => {
    const session = setup();
    const calls: string[] = [];
    const a = ref(true);
    const b = ref(true);
    session.register("sincronizar", {
      isDirty: () => a.value,
      save: async () => {
        calls.push("sincronizar");
        a.value = false;
      },
      discard: () => {}
    });
    session.register("cancion", {
      isDirty: () => b.value,
      save: async () => {
        calls.push("cancion");
        b.value = false;
      },
      discard: () => {}
    });
    expect(await session.save()).toBe(true);
    expect(calls).toEqual(["cancion", "sincronizar"]);
    expect(session.lastSavedAt.value).not.toBeNull();
  });

  it("reports failure when something stays dirty", async () => {
    const session = setup();
    session.register("cancion", { isDirty: () => true, save: async () => {}, discard: () => {} });
    expect(await session.save()).toBe(false);
    expect(session.lastSavedAt.value).toBeNull();
  });

  it("blocks saving while a part says it can't be saved", async () => {
    const session = setup();
    const save = vi.fn(async () => {});
    session.register("cancion", { isDirty: () => true, save, discard: () => {} });
    session.register("letra", {
      isDirty: () => false,
      save: async () => {},
      discard: () => {},
      canSave: () => false
    });
    expect(session.canSave.value).toBe(false);
    await session.save();
    expect(save).not.toHaveBeenCalled();
  });

  it("discards only the dirty parts", async () => {
    const session = setup();
    const discardDirty = vi.fn();
    const discardClean = vi.fn();
    session.register("cancion", {
      isDirty: () => true,
      save: async () => {},
      discard: discardDirty
    });
    session.register("sincronizar", {
      isDirty: () => false,
      save: async () => {},
      discard: discardClean
    });
    await session.discard();
    expect(discardDirty).toHaveBeenCalledOnce();
    expect(discardClean).not.toHaveBeenCalled();
  });

  it("asks before leaving only when there are changes", async () => {
    const session = setup();
    expect(await session.confirmLeave()).toBe("discard");
    expect(session.pendingLeave.value).toBeNull();

    session.register("cancion", { isDirty: () => true, save: async () => {}, discard: () => {} });
    const answer = session.confirmLeave();
    expect(session.pendingLeave.value).not.toBeNull();
    session.pendingLeave.value!("stay");
    expect(await answer).toBe("stay");
    expect(session.pendingLeave.value).toBeNull();
  });

  it("unregisters a part", () => {
    const session = setup();
    const off = session.register("cancion", {
      isDirty: () => true,
      save: async () => {},
      discard: () => {}
    });
    off();
    expect(session.isDirty.value).toBe(false);
  });
});
