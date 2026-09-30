import { shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import PlayerTopBar from "@/components/player/PlayerTopBar.vue";
import type { CollectionWithRole, Song } from "@/data/types";

describe("PlayerTopBar", () => {
  it("shows artwork resolved from an R2 key without a legacy URL", () => {
    const wrapper = shallowMount(PlayerTopBar, {
      props: {
        collection: {
          id: 7,
          slug: "coro",
          title: "Coro",
          hue: 300,
          intensity: "media",
          track_colors: {},
          artwork_file_key: "artwork/7/cover.webp",
          artwork_playback_url: "https://signed.example/cover",
          visibility: "private",
          created_by: null,
          created_at: "2026-09-30T00:00:00Z",
          user_role: "viewer"
        } satisfies CollectionWithRole,
        song: { id: 1, title: "Canción" } as Song,
        songCount: 1,
        canEdit: false,
        isAdmin: false,
        editMode: false,
        exporting: false,
        canDownload: false
      }
    });

    expect(wrapper.get("img").attributes("src")).toBe("https://signed.example/cover");
  });
});
