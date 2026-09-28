import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AudioTrackUploader from "@/components/editor/AudioTrackUploader.vue";
import type { AudioTrack, CollectionWithRole } from "@/data/types";

const mocks = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  generateTrackPeaks: vi.fn()
}));

vi.mock("@/data/storage", () => ({ uploadFile: mocks.uploadFile }));
vi.mock("@/utils/audio-utils", () => ({ generateTrackPeaks: mocks.generateTrackPeaks }));
vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

const track: AudioTrack = {
  id: -7,
  song_id: 1,
  title: "",
  color_key: "blue",
  audio_file_url: "",
  peaks: null,
  order: 1,
  created_at: "2026-01-01T00:00:00Z"
};

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
  mocks.uploadFile.mockResolvedValue({
    url: "https://project.supabase.co/storage/v1/object/public/audio-files/obra/tema.mp3",
    filename: "obra/tema.mp3",
    size: 3
  });
});

describe("AudioTrackUploader", () => {
  it("exposes dropped-file uploading to the track card", async () => {
    const wrapper = mount(AudioTrackUploader, {
      props: { track, collection, song: { slug: "tema" } }
    });
    expect(wrapper.get("label").text()).toContain("Elegir audio");

    const file = new File(["audio"], "voz.mp3", { type: "audio/mpeg" });
    await (
      wrapper.vm as unknown as { uploadDroppedFile: (droppedFile: File) => Promise<void> }
    ).uploadDroppedFile(file);
    await flushPromises();

    expect(mocks.uploadFile).toHaveBeenCalledWith(file, "obra/tema-7.mp3", {
      bucket: "audio-files",
      addRandomSuffix: true
    });
    expect(wrapper.emitted("upload-success")?.[0]?.[0]).toMatchObject({
      suggestedTitle: "voz",
      url: "https://project.supabase.co/storage/v1/object/public/audio-files/obra/tema.mp3"
    });
  });
});
