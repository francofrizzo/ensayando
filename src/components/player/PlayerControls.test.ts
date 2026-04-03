import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import PlayerControls from "./PlayerControls.vue";

function mountControls(props: Partial<InstanceType<typeof PlayerControls>["$props"]> = {}) {
  return mount(PlayerControls, {
    props: {
      currentTime: 0,
      totalDuration: 180,
      isPlaying: false,
      isReady: true,
      prevSong: null,
      nextSong: null,
      ...props
    }
  });
}

describe("PlayerControls", () => {
  it("shows Play icon when not playing", () => {
    const wrapper = mountControls({ isPlaying: false });
    expect(wrapper.find("[aria-label='Play/Pause']").exists()).toBe(true);
  });

  it("shows spinner when not ready", () => {
    const wrapper = mountControls({ isReady: false });
    expect(wrapper.find(".loading-spinner").exists()).toBe(true);
  });

  it("hides time display when not ready", () => {
    const wrapper = mountControls({ isReady: false });
    expect(wrapper.find("[data-testid='time-display']").exists()).toBe(false);
  });

  it("shows time display when ready", () => {
    const wrapper = mountControls({ isReady: true });
    expect(wrapper.find("[data-testid='time-display']").exists()).toBe(true);
  });

  it("emits play-pause on click", async () => {
    const wrapper = mountControls({ isReady: true });
    await wrapper.find("[aria-label='Play/Pause']").trigger("click");
    expect(wrapper.emitted("play-pause")).toBeTruthy();
  });

  it("does not emit play-pause when not ready", async () => {
    const wrapper = mountControls({ isReady: false });
    await wrapper.find("[aria-label='Play/Pause']").trigger("click");
    expect(wrapper.emitted("play-pause")).toBeUndefined();
  });

  it("disables prev/next buttons when no adjacent songs", () => {
    const wrapper = mountControls({ prevSong: null, nextSong: null });
    expect(wrapper.find("[aria-label='Canción anterior']").attributes("disabled")).toBeDefined();
    expect(wrapper.find("[aria-label='Canción siguiente']").attributes("disabled")).toBeDefined();
  });
});
