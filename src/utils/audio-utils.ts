import type { TrackPeaks } from "@/data/types";

export const generateTrackPeaks = async (
  file: File,
  samples = 1000,
  scale = 100
): Promise<TrackPeaks> => {
  const AC = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buf = await file.arrayBuffer();
  const audio = await AC.decodeAudioData(buf);

  const duration = audio.duration;
  const length = audio.length;
  const blocks = Math.max(1, Math.min(samples, length));
  const blockSize = Math.ceil(length / blocks);
  const channels: number[][] = [];

  for (let c = 0; c < audio.numberOfChannels; c++) {
    const data = audio.getChannelData(c);
    const peaks = new Array(blocks);

    for (let i = 0; i < blocks; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, data.length);

      let peak = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]!);
        if (v > peak) peak = v;
      }

      peaks[i] = Math.min(scale, Math.round(peak * scale));
    }

    channels.push(peaks);
  }

  return { channels, duration };
};
