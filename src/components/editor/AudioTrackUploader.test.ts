import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AudioTrackUploader from "@/components/editor/AudioTrackUploader.vue";
import type { CollectionWithRole } from "@/data/types";

const mocks = vi.hoisted(() => ({
  uploadAudioFile: vi.fn(),
  generateTrackPeaks: vi.fn()
}));

vi.mock("@/data/storage", () => ({ uploadAudioFile: mocks.uploadAudioFile }));
vi.mock("@/utils/audio-utils", () => ({ generateTrackPeaks: mocks.generateTrackPeaks }));
vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

const collection: CollectionWithRole = {
  id: 1,
  slug: "obra",
  title: "Obra",
  main_color: "blue",
  track_colors: {},
  artwork_file_url: null,
  visibility: "private",
  created_at: "2026-01-01T00:00:00Z",
  user_role: "admin"
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateTrackPeaks.mockResolvedValue({ channels: [[0, 1]], duration: 1 });
  mocks.uploadAudioFile.mockResolvedValue({
    key: "audio/1/new.mp3",
    url: "https://signed.example/new.mp3",
    filename: "voz.mp3",
    size: 3
  });
});

describe("AudioTrackUploader", () => {
  it("exposes dropped-file uploading to the track card", async () => {
    const wrapper = mount(AudioTrackUploader, {
      props: { collection }
    });
    expect(wrapper.get("label").text()).toContain("Elegir audio");

    const file = new File(["audio"], "voz.mp3", { type: "audio/mpeg" });
    await (
      wrapper.vm as unknown as { uploadDroppedFile: (droppedFile: File) => Promise<void> }
    ).uploadDroppedFile(file);
    await flushPromises();

    expect(mocks.uploadAudioFile).toHaveBeenCalledWith(file, collection.id);
    expect(wrapper.emitted("upload-success")?.[0]?.[0]).toMatchObject({
      key: "audio/1/new.mp3",
      suggestedTitle: "voz",
      url: "https://signed.example/new.mp3"
    });
  });
});
