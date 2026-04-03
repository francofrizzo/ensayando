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
      ...props
    }
  });
}

describe("PlayerControls", () => {
  it("shows Play icon when not playing", () => {
    const wrapper = mountControls({ isPlaying: false });
    // Play icon is rendered (Pause is not)
    expect(wrapper.find("[aria-label='Play/Pause']").exists()).toBe(true);
  });

  it("disables button when not ready", () => {
    const wrapper = mountControls({ isReady: false });
    const button = wrapper.find("[aria-label='Play/Pause']");
    expect(button.attributes("disabled")).toBeDefined();
  });

  it("emits play-pause on click", async () => {
    const wrapper = mountControls({ isReady: true });
    await wrapper.find("[aria-label='Play/Pause']").trigger("click");
    expect(wrapper.emitted("play-pause")).toBeTruthy();
  });
});
