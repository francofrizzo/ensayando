import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  in: vi.fn(),
  remove: vi.fn()
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => ({ select: mocks.select })),
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: () => ({ data: { publicUrl: "https://project.supabase.co/audio-files/" } }),
        remove: mocks.remove
      }))
    }
  }
}));

import { getPublicStoragePath, removeUnreferencedAudioFiles } from "@/data/storage";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.select.mockReturnValue({ in: mocks.in });
  mocks.in.mockResolvedValue({ data: [], error: null });
  mocks.remove.mockResolvedValue({ data: [], error: null });
});

describe("getPublicStoragePath", () => {
  it("extracts and decodes a path from the requested public bucket", () => {
    expect(
      getPublicStoragePath(
        "https://project.supabase.co/storage/v1/object/public/audio-files/obra/canci%C3%B3n.mp3",
        "audio-files",
        "https://project.supabase.co"
      )
    ).toBe("obra/canción.mp3");
  });

  it("rejects external URLs and other buckets", () => {
    expect(
      getPublicStoragePath(
        "https://example.com/storage/v1/object/public/audio-files/audio.mp3",
        "audio-files",
        "https://project.supabase.co"
      )
    ).toBeNull();
    expect(
      getPublicStoragePath(
        "https://project.supabase.co/storage/v1/object/public/artwork/image.jpg",
        "audio-files",
        "https://project.supabase.co"
      )
    ).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(
      getPublicStoragePath("not a URL", "audio-files", "https://project.supabase.co")
    ).toBeNull();
  });
});

describe("removeUnreferencedAudioFiles", () => {
  it("removes only Supabase files that no database track still references", async () => {
    const referencedUrl =
      "https://project.supabase.co/storage/v1/object/public/audio-files/obra/used.mp3";
    const unusedUrl =
      "https://project.supabase.co/storage/v1/object/public/audio-files/obra/unused.mp3";
    mocks.in.mockResolvedValue({
      data: [{ audio_file_url: referencedUrl }],
      error: null
    });

    await removeUnreferencedAudioFiles([
      referencedUrl,
      unusedUrl,
      "https://external.example/audio.mp3"
    ]);

    expect(mocks.in).toHaveBeenCalledWith("audio_file_url", [referencedUrl, unusedUrl]);
    expect(mocks.remove).toHaveBeenCalledWith(["obra/unused.mp3"]);
  });
});
