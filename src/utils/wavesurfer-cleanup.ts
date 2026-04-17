type WebAudioMedia = {
  audioContext?: { close: () => Promise<void> };
};

type CleanableWaveSurfer = {
  pause: () => void;
  destroy: () => void;
  getMediaElement?: () => unknown;
};

// WaveSurfer 7's WebAudio backend wraps a WebAudioPlayer that Player.destroy()
// treats as external media, so destroy() skips media.pause() and the buffer
// keeps playing. wavesurfer also ignores the `audioContext` option and spins up
// its own AudioContext per instance that destroy() never closes. We pause
// manually and close the context to stop background audio and release resources.
export async function cleanupWaveSurfer(ws: CleanableWaveSurfer | null | undefined): Promise<void> {
  if (!ws) return;

  try {
    ws.pause();
  } catch {
    /* no-op */
  }

  const media = (ws.getMediaElement?.() ?? null) as unknown as WebAudioMedia | null;

  try {
    ws.destroy();
  } catch {
    /* no-op */
  }

  const ctx = media?.audioContext;
  if (ctx && typeof ctx.close === "function") {
    try {
      await ctx.close();
    } catch {
      /* no-op */
    }
  }
}
