type WebAudioMedia = {
  audioContext?: { close: () => Promise<void> };
  getGainNode?: () => { disconnect: () => void };
  removeAttribute?: (attribute: string) => void;
};

type CleanableWaveSurfer = {
  pause: () => void;
  destroy: () => void;
  getMediaElement?: () => unknown;
};

// WaveSurfer 7's WebAudio backend wraps a WebAudioPlayer that Player.destroy()
// treats as external media, so destroy() skips media.pause() and the buffer
// keeps playing. Release the track's buffer and graph, but preserve an explicitly
// shared context so the next song can reuse its user-gesture authorization.
export async function cleanupWaveSurfer(
  ws: CleanableWaveSurfer | null | undefined,
  sharedContext?: WebAudioMedia["audioContext"]
): Promise<void> {
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
  try {
    media?.getGainNode?.().disconnect();
    media?.removeAttribute?.("src");
  } catch {
    /* ignore cleanup errors */
  }
  if (ctx && ctx !== sharedContext && typeof ctx.close === "function") {
    try {
      await ctx.close();
    } catch {
      /* no-op */
    }
  }
}
