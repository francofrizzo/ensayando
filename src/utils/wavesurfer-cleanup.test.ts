import { describe, expect, it, vi } from "vitest";

import { cleanupWaveSurfer } from "./wavesurfer-cleanup";

type FakeOptions = {
  pauseThrows?: boolean;
  destroyThrows?: boolean;
  closeThrows?: boolean;
  withAudioContext?: boolean;
};

function makeFakeWs(options: FakeOptions = {}) {
  const {
    pauseThrows = false,
    destroyThrows = false,
    closeThrows = false,
    withAudioContext = true
  } = options;

  const audioContext = withAudioContext
    ? {
        close: vi.fn(() =>
          closeThrows ? Promise.reject(new Error("close boom")) : Promise.resolve()
        )
      }
    : undefined;

  const media = { audioContext };

  const ws = {
    pause: vi.fn(() => {
      if (pauseThrows) throw new Error("pause boom");
    }),
    destroy: vi.fn(() => {
      if (destroyThrows) throw new Error("destroy boom");
    }),
    getMediaElement: vi.fn(() => media)
  };

  return { ws, media, audioContext };
}

describe("cleanupWaveSurfer", () => {
  it("pauses before destroy and then closes the audio context", async () => {
    const { ws, audioContext } = makeFakeWs();

    await cleanupWaveSurfer(ws as never);

    expect(ws.pause).toHaveBeenCalledOnce();
    expect(ws.destroy).toHaveBeenCalledOnce();
    expect(audioContext?.close).toHaveBeenCalledOnce();

    const pauseOrder = ws.pause.mock.invocationCallOrder[0]!;
    const destroyOrder = ws.destroy.mock.invocationCallOrder[0]!;
    expect(pauseOrder).toBeLessThan(destroyOrder);
  });

  it("still destroys and closes the context if pause throws", async () => {
    const { ws, audioContext } = makeFakeWs({ pauseThrows: true });

    await cleanupWaveSurfer(ws as never);

    expect(ws.destroy).toHaveBeenCalled();
    expect(audioContext?.close).toHaveBeenCalled();
  });

  it("still closes the context if destroy throws", async () => {
    const { ws, audioContext } = makeFakeWs({ destroyThrows: true });

    await cleanupWaveSurfer(ws as never);

    expect(audioContext?.close).toHaveBeenCalled();
  });

  it("swallows errors from audioContext.close()", async () => {
    const { ws } = makeFakeWs({ closeThrows: true });

    await expect(cleanupWaveSurfer(ws as never)).resolves.toBeUndefined();
  });

  it("is a no-op on null/undefined input", async () => {
    await expect(cleanupWaveSurfer(null)).resolves.toBeUndefined();
    await expect(cleanupWaveSurfer(undefined)).resolves.toBeUndefined();
  });

  it("skips closing when media has no audioContext", async () => {
    const { ws } = makeFakeWs({ withAudioContext: false });

    await cleanupWaveSurfer(ws as never);

    expect(ws.pause).toHaveBeenCalled();
    expect(ws.destroy).toHaveBeenCalled();
  });
});
