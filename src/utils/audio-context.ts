let playbackContext: AudioContext | undefined;

// Keep the context unlocked by Play for the whole app session, including song changes.
export function getPlaybackAudioContext(): AudioContext {
  return (playbackContext ??= new AudioContext({ sampleRate: 44100, latencyHint: "playback" }));
}
