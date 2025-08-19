import type { TrackPeaks } from "@/data/types";

export const generateTrackPeaks = async (
  file: File,
  targetSamples = 1500,
  scale = 100
): Promise<TrackPeaks> => {
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const AC = new AudioCtx({ sampleRate: 44100 });
  const buf = await file.arrayBuffer();
  const audio = await AC.decodeAudioData(buf);

  // Downsample peaks to a small, view-oriented size to keep memory tiny
  const duration = Math.round(audio.duration * 1000) / 1000; // seconds with ms precision
  const length = audio.length; // samples per channel
  const blocks = Math.max(1, Math.min(targetSamples, length));
  const blockSize = Math.ceil(length / blocks);
  const channels: number[][] = [];

  for (let c = 0; c < audio.numberOfChannels; c++) {
    const data = audio.getChannelData(c);
    const peaks: number[] = new Array(blocks);

    for (let i = 0; i < blocks; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, data.length);
      let peak = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]!);
        if (v > peak) peak = v;
      }
      // Quantize and clamp to keep payload small
      peaks[i] = Math.min(scale, Math.round(peak * scale));
    }
    channels.push(peaks);
  }

  try {
    await AC.close();
  } catch (e) {
    // ignore close errors
  }

  return { channels, duration };
};
