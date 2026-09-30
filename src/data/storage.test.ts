import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn()
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: mocks.getSession }
  }
}));

import {
  artworkPlaybackUrl,
  deleteAudioFile,
  resolveAudioTrackUrls,
  uploadArtworkFile,
  uploadAudioFile
} from "@/data/storage";
import type { AudioTrack, Collection } from "@/data/types";

const response = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: "session-token" } } });
});

describe("R2 browser storage adapter", () => {
  it("uploads collection artwork as the artwork file type", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        response({ key: "artwork/7/a.png", url: "https://signed.example/up", headers: {} })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(response({ url: "https://signed.example/read", size: 3 }));
    const file = new File(["img"], "portada.png", { type: "image/png" });

    await uploadArtworkFile(file, 7);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      action: "sign-upload",
      fileType: "artwork",
      contentType: "image/png",
      collectionId: 7
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      action: "complete-upload",
      fileType: "artwork"
    });
  });

  it("uploads directly to a signed URL and completes the upload through the API", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        response({
          key: "audio/7/new.mp3",
          url: "https://signed.example/upload",
          headers: { "Content-Type": "audio/mpeg" }
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(response({ url: "https://signed.example/read", size: 5 }));
    const file = new File(["audio"], "voz.mp3", { type: "audio/mpeg" });

    await expect(uploadAudioFile(file, 7)).resolves.toEqual({
      key: "audio/7/new.mp3",
      url: "https://signed.example/read",
      filename: "voz.mp3",
      size: 5
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/storage",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer session-token" })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://signed.example/upload", {
      method: "PUT",
      headers: { "Content-Type": "audio/mpeg" },
      body: file
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
      action: "complete-upload",
      fileType: "audio",
      key: "audio/7/new.mp3"
    });
  });

  it("uses signed playback URLs while preserving external URL tracks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      response({ urls: { "1": "https://signed.example/track" } })
    );
    const tracks = [
      {
        id: 1,
        audio_file_key: "audio/7/track.mp3",
        audio_file_url: ""
      },
      { id: 2, audio_file_key: null, audio_file_url: "https://external.example/other.mp3" }
    ] as AudioTrack[];

    const resolved = await resolveAudioTrackUrls(tracks);

    expect(resolved[0]?.playback_url).toBe("https://signed.example/track");
    expect(resolved[1]?.playback_url).toBe("https://external.example/other.mp3");
    expect(resolved[1]?.audio_file_url).toBe("https://external.example/other.mp3");
  });

  it("uses only the resolved R2 URL for collection artwork", () => {
    expect(
      artworkPlaybackUrl({ artwork_file_key: "artwork/7/cover.webp" } as Collection)
    ).toBe("");
    expect(
      artworkPlaybackUrl({ artwork_playback_url: "https://signed.example/cover" } as Collection)
    ).toBe("https://signed.example/cover");
  });

  it("deletes an R2 key through the authenticated API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(null, 204));

    await deleteAudioFile("audio/7/unused.mp3");

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      action: "delete",
      fileType: "audio",
      key: "audio/7/unused.mp3"
    });
  });
});
