import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

import { createSettingsGuard } from "./useSettingsGuard";

const section = () => {
  const dirty = ref(true);
  const calls: string[] = [];
  return {
    dirty,
    calls,
    handle: {
      label: "los colores",
      isDirty: () => dirty.value,
      save: async () => {
        calls.push("save");
        dirty.value = false;
      },
      discard: () => {
        calls.push("discard");
        dirty.value = false;
      }
    }
  };
};

describe("settings guard", () => {
  it("lets you leave a clean section without asking", async () => {
    const guard = createSettingsGuard();
    const s = section();
    s.dirty.value = false;
    guard.register(s.handle);
    expect(await guard.confirmLeave()).toBe(true);
    expect(guard.pending.value).toBeNull();
  });

  it("asks when dirty, and stays when told to", async () => {
    const guard = createSettingsGuard();
    const s = section();
    guard.register(s.handle);
    const leaving = guard.confirmLeave();
    await nextTick();
    expect(guard.summary.value).toContain("los colores");
    guard.pending.value!("stay");
    expect(await leaving).toBe(false);
    expect(s.calls).toEqual([]);
  });

  it("discards or saves before leaving", async () => {
    const guard = createSettingsGuard();
    const a = section();
    guard.register(a.handle);
    const discarding = guard.confirmLeave();
    guard.pending.value!("discard");
    expect(await discarding).toBe(true);
    expect(a.calls).toEqual(["discard"]);

    const b = section();
    guard.register(b.handle);
    const saving = guard.confirmLeave();
    guard.pending.value!("save");
    expect(await saving).toBe(true);
    expect(b.calls).toEqual(["save"]);
  });

  it("stays when saving fails to clear the changes", async () => {
    const guard = createSettingsGuard();
    const s = section();
    s.handle.save = async () => {
      s.calls.push("save");
    };
    guard.register(s.handle);
    const leaving = guard.confirmLeave();
    guard.pending.value!("save");
    expect(await leaving).toBe(false);
  });
});
