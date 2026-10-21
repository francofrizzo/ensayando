import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import TrackRow from "@/components/editor/TrackRow.vue";

describe("track display color", () => {
  it("shows color names without codes and saves the selected key independently of parts", async () => {
    const wrapper = mount(TrackRow, {
      props: {
        track: {
          id: 7,
          song_id: 1,
          title: "Solistas",
          color_key: "b",
          part_ids: ["eliza", "hamilton"],
          audio_file_url: "",
          peaks: null,
          order: 1,
          created_at: ""
        },
        index: 0,
        total: 1,
        stage: "rgb(10, 20, 200)",
        wave: "rgb(10, 20, 200)",
        colorOptions: [
          { key: "a", name: "Rojo", value: "rgb(200, 20, 10)" },
          { key: "b", name: "Azul", value: "rgb(10, 20, 200)" }
        ],
        showAdvanced: false
      }
    });
    expect(wrapper.get('[data-testid="track-color"]').text()).toBe("");
    await wrapper.get('[data-testid="track-color"]').trigger("click");
    expect(wrapper.get('[aria-pressed="true"]').text()).toContain("Azul");
    const red = wrapper.get('[aria-pressed="false"]');
    expect(red.text()).toContain("Rojo");
    expect(red.text()).toBe("Rojo");
    await red.trigger("click");
    expect(wrapper.emitted("color")).toEqual([["a"]]);
    expect(wrapper.emitted("parts")).toBeUndefined();
    expect(wrapper.get('[data-testid="track-color"]').attributes("aria-expanded")).toBe("false");
  });
});
