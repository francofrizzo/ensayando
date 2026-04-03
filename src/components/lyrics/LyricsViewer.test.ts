import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import LyricsViewer from "./LyricsViewer.vue";
import { mockCollection, timedVerse, trackVerse } from "@/__fixtures__/lyrics";
import type { LyricStanza } from "@/data/types";

function mountViewer(lyrics: LyricStanza[], currentTime = 0, enabledTrackIds: number[] = []) {
  return mount(LyricsViewer, {
    props: {
      collection: mockCollection,
      lyrics,
      currentTime,
      isDisabled: false,
      enabledTrackIds
    }
  });
}

describe("LyricsViewer", () => {
  it("renders correct number of verses", () => {
    const lyrics: LyricStanza[] = [
      [{ text: "Line 1" }, { text: "Line 2" }],
      [{ text: "Line 3" }]
    ];
    const wrapper = mountViewer(lyrics);
    // 3 total verse texts
    const texts = wrapper.findAll("span").filter((s) => s.text());
    const verseTexts = texts.map((s) => s.text()).filter((t) => ["Line 1", "Line 2", "Line 3"].includes(t));
    expect(verseTexts).toEqual(["Line 1", "Line 2", "Line 3"]);
  });

  it("marks active verse with font-semibold", () => {
    const lyrics: LyricStanza[] = [
      [timedVerse(1, 5, "Active"), timedVerse(6, 10, "Future")]
    ];
    const wrapper = mountViewer(lyrics, 3);
    const spans = wrapper.findAll("span");
    const activeSpan = spans.find((s) => s.text() === "Active");
    expect(activeSpan?.classes()).toContain("font-semibold");

    const futureSpan = spans.find((s) => s.text() === "Future");
    expect(futureSpan?.classes()).not.toContain("font-semibold");
  });

  it("hides verses with non-matching audio_track_ids", () => {
    const lyrics: LyricStanza[] = [
      [trackVerse("Visible", [1]), trackVerse("Hidden", [2])]
    ];
    const wrapper = mountViewer(lyrics, 0, [1]);
    const text = wrapper.text();
    expect(text).toContain("Visible");
    expect(text).not.toContain("Hidden");
  });

  it("renders multicolumn items", () => {
    const lyrics: LyricStanza[] = [
      [
        [
          [{ text: "Col A" }],
          [{ text: "Col B" }]
        ]
      ]
    ];
    const wrapper = mountViewer(lyrics);
    expect(wrapper.text()).toContain("Col A");
    expect(wrapper.text()).toContain("Col B");
  });

  it("emits seek on verse click", async () => {
    const lyrics: LyricStanza[] = [
      [timedVerse(5, 10, "Clickable")]
    ];
    const wrapper = mountViewer(lyrics, 0);
    const clickTarget = wrapper.findAll("div").find(
      (d) => d.text().includes("Clickable") && d.attributes("class")?.includes("snap-center")
    );
    await clickTarget?.trigger("click");
    expect(wrapper.emitted("seek")).toBeTruthy();
    expect(wrapper.emitted("seek")![0]).toEqual([5]);
  });
});
