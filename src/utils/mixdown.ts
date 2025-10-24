/* eslint-disable @typescript-eslint/no-explicit-any */
// Offline mixdown and MP3 encoding utilities

export async function mixAndEncodeMp3(
  urls: (string | null | undefined)[],
  gains: number[],
  options: {
    duration: number;
    sampleRate?: number;
    buffers?: (AudioBuffer | null | undefined)[];
    bitrateKbps?: number;
  }
): Promise<Blob> {
  const sampleRate = options.sampleRate ?? 44100;
  const duration = Math.max(0, options.duration || 0);
  const bitrateKbps = options.bitrateKbps ?? 192;

  console.log("[mixdown] Starting export:", {
    tracks: urls.length,
    gains,
    duration,
    sampleRate,
    bitrateKbps
  });

  const existing = options.buffers ?? [];
  console.log(
    "[mixdown] Existing buffers:",
    existing.map((b) => (b ? `${b.length} samples` : "null"))
  );

  const buffers = await decodeAll(urls, sampleRate, existing);
  console.log(
    "[mixdown] Decoded buffers:",
    buffers.map((b) => `${b.length} samples, ${b.numberOfChannels}ch`)
  );

  const rendered = await renderOffline(buffers, gains, duration, sampleRate);
  console.log("[mixdown] Rendered:", {
    length: rendered.length,
    channels: rendered.numberOfChannels,
    duration: rendered.duration,
    sampleRate: rendered.sampleRate
  });

  // Check if rendered is silent
  const leftPeak = checkPeak(rendered.getChannelData(0));
  const rightPeak =
    rendered.numberOfChannels > 1 ? checkPeak(rendered.getChannelData(1)) : leftPeak;
  console.log("[mixdown] Rendered peaks:", { left: leftPeak, right: rightPeak });

  const mp3 = await encodeMp3(rendered, sampleRate, bitrateKbps);
  console.log(
    "[mixdown] Encoded MP3 chunks:",
    mp3.length,
    "total bytes:",
    mp3.reduce((sum, chunk) => sum + chunk.length, 0)
  );
  return new Blob(mp3 as any, { type: "audio/mpeg" });
}

export async function decodeAll(
  urls: (string | null | undefined)[],
  sampleRate: number,
  existing: (AudioBuffer | null | undefined)[] = []
): Promise<AudioBuffer[]> {
  const AudioCtx: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const ac = AudioCtx ? new AudioCtx({ sampleRate }) : new (window as any).AudioContext();

  const results: AudioBuffer[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (existing[i]) {
      // Only accept existing if it can be coerced into a non-empty buffer AND is reasonably long
      // WaveSurfer may provide tiny peak buffers (e.g. 1000 samples) instead of full audio
      const ok = isUsableBufferLike(existing[i]);
      const len = (existing[i] as any)?.length ?? 0;
      const minExpectedSamples = sampleRate * 0.1; // At least 100ms of audio
      if (ok && len > minExpectedSamples) {
        console.log(`[mixdown] Track ${i}: using existing buffer (${len} samples)`);
        results[i] = existing[i] as AudioBuffer;
        continue;
      } else {
        console.log(
          `[mixdown] Track ${i}: existing buffer too short (${len} samples), will fetch full audio`
        );
      }
    }
    const url = urls[i];
    if (!url) {
      console.log(`[mixdown] Track ${i}: no URL, creating silent buffer`);
      // Create empty buffer if missing
      results[i] = ac.createBuffer(2, 1, sampleRate);
      continue;
    }
    try {
      console.log(`[mixdown] Track ${i}: fetching ${url}`);
      const resp = await fetch(url as string);
      const ab = await resp.arrayBuffer();
      const audio = await ac.decodeAudioData(ab);
      console.log(
        `[mixdown] Track ${i}: decoded ${audio.length} samples, ${audio.numberOfChannels}ch`
      );
      results[i] = audio;
    } catch (e) {
      console.error(`[mixdown] Track ${i}: fetch/decode failed:`, e);
      // On failure, return silence buffer of 1 frame to keep alignment
      results[i] = ac.createBuffer(2, 1, sampleRate);
    }
  }
  try {
    ac.close?.();
  } catch {
    // ignore close errors
  }
  return results;
}

export async function renderOffline(
  buffers: (AudioBuffer | any)[],
  gains: number[],
  duration: number,
  sampleRate: number
): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  const offline = new OfflineAudioContext(2, length, sampleRate);

  console.log(`[mixdown] renderOffline: ${buffers.length} buffers, ${length} samples target`);

  let sourcesConnected = 0;
  buffers.forEach((bufferLike, i) => {
    const gain = Math.max(0, Math.min(1, gains[i] ?? 0));
    if (!bufferLike || gain === 0) {
      console.log(`[mixdown] Track ${i}: skipped (gain=${gain}, hasBuffer=${!!bufferLike})`);
      return;
    }

    const coerced = coerceToAudioBuffer(offline, bufferLike, sampleRate);
    if (!coerced) {
      console.log(`[mixdown] Track ${i}: coercion failed`);
      return;
    }

    console.log(`[mixdown] Track ${i}: connecting with gain=${gain}, length=${coerced.length}`);
    const source = offline.createBufferSource();
    source.buffer = coerced;
    const g = offline.createGain();
    g.gain.value = gain;
    source.connect(g).connect(offline.destination);
    try {
      source.start(0);
      sourcesConnected++;
    } catch (e) {
      console.error(`[mixdown] Track ${i}: start failed:`, e);
    }
  });

  console.log(`[mixdown] Connected ${sourcesConnected} sources, rendering...`);
  const rendered = await offline.startRendering();
  console.log(`[mixdown] Offline render complete: ${rendered.length} samples`);

  // If rendered buffer looks silent, fallback to direct JS mixing
  if (isAlmostSilent(rendered)) {
    console.warn("[mixdown] Rendered buffer is silent, falling back to JS mix");
    const fallback = await jsMixToBuffer(buffers, gains, duration, sampleRate);
    return fallback ?? rendered;
  }

  // Apply normalization with headroom to prevent clipping
  return normalizeBuffer(rendered);
}

export async function encodeMp3(
  buffer: AudioBuffer,
  sampleRate: number,
  bitrateKbps = 192
): Promise<Uint8Array[]> {
  // Try ESM first; if the runtime build of lamejs expects globals, fall back to UMD
  let Mp3EncoderCtor: any | null = null;
  try {
    const lameModule: any = await import("lamejs");
    const lamejs: any = lameModule?.default ?? lameModule;
    // Some builds of lamejs expect certain enums on the global scope
    const g = window as any;
    if (lameModule?.MPEGMode && !g.MPEGMode) g.MPEGMode = lameModule.MPEGMode;
    if (lameModule?.VBRMode && !g.VBRMode) g.VBRMode = lameModule.VBRMode;
    if (lameModule?.VBRMethod && !g.VBRMethod) g.VBRMethod = lameModule.VBRMethod;
    Mp3EncoderCtor = lamejs?.Mp3Encoder ?? null;
  } catch {
    Mp3EncoderCtor = null;
  }

  // If ESM path is unavailable or broken, dynamically load UMD from CDN
  if (!Mp3EncoderCtor) {
    await ensureLameJsUmdLoaded();
    const g = window as any;
    Mp3EncoderCtor = g?.lamejs?.Mp3Encoder ?? g?.Mp3Encoder ?? null;
  }

  if (!Mp3EncoderCtor) {
    throw new Error("Failed to load lamejs Mp3Encoder");
  }

  const numChannels = Math.min(2, buffer.numberOfChannels || 2);
  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0);

  let encoder: any;
  try {
    encoder = new Mp3EncoderCtor(2, sampleRate, bitrateKbps);
  } catch (e: any) {
    // Last-ditch: if this is an MPEGMode undefined error, retry after forcing UMD
    const message = String(e?.message || e);
    if (message.includes("MPEGMode is not defined")) {
      await ensureLameJsUmdLoaded();
      const g = window as any;
      const FallbackCtor = g?.lamejs?.Mp3Encoder ?? g?.Mp3Encoder;
      if (!FallbackCtor) throw e;
      encoder = new FallbackCtor(2, sampleRate, bitrateKbps);
    } else {
      throw e;
    }
  }
  const blockSize = 1152; // MP3 frame size
  const mp3Data: Uint8Array[] = [];

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = floatTo16(left, i, blockSize);
    const rightChunk = floatTo16(right, i, blockSize);
    const enc = encoder.encodeBuffer(leftChunk, rightChunk);
    if (enc.length > 0) mp3Data.push(enc);
  }
  const end = encoder.flush();
  if (end.length > 0) mp3Data.push(end);
  return mp3Data;
}

function floatTo16(src: Float32Array, start: number, len: number): Int16Array {
  const out = new Int16Array(Math.min(len, src.length - start));
  for (let i = 0; i < out.length; i++) {
    const s = Math.max(-1, Math.min(1, src[start + i] || 0));
    out[i] = s < 0 ? (s * 0x8000) | 0 : (s * 0x7fff) | 0;
  }
  return out;
}

function coerceToAudioBuffer(
  offline: OfflineAudioContext,
  bufferLike: any,
  sampleRate: number
): AudioBuffer | null {
  try {
    // Case 1: Already an AudioBuffer — clone into this context
    if (bufferLike && typeof bufferLike.getChannelData === "function") {
      const channels = Math.min(2, bufferLike.numberOfChannels ?? 2);
      const length = bufferLike.length ?? 0;
      if (!length) return null;
      const out = offline.createBuffer(channels, length, sampleRate);
      for (let c = 0; c < channels; c++) {
        const src = bufferLike.getChannelData(c);
        out.getChannelData(c).set(src.subarray(0, length));
      }
      return out;
    }

    // Case 2: Array of Float32Array channels: [Float32Array, Float32Array]
    if (
      Array.isArray(bufferLike) &&
      bufferLike.length > 0 &&
      bufferLike[0] instanceof Float32Array
    ) {
      const channels = Math.min(2, bufferLike.length);
      const length = bufferLike[0].length;
      const out = offline.createBuffer(channels, length, sampleRate);
      for (let c = 0; c < channels; c++) {
        out.getChannelData(c).set(bufferLike[c]);
      }
      // Upmix mono to stereo if needed
      if (channels === 1) {
        out.copyToChannel(out.getChannelData(0), 1);
      }
      return out;
    }

    // Unknown format — skip
    return null;
  } catch {
    return null;
  }
}

function isUsableBufferLike(candidate: any): boolean {
  try {
    // AudioBuffer
    if (candidate && typeof candidate.getChannelData === "function") {
      const len = candidate.length ?? 0;
      return len > 0;
    }
    // [Float32Array, Float32Array]
    if (Array.isArray(candidate) && candidate.length > 0 && candidate[0] instanceof Float32Array) {
      return candidate[0].length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

async function ensureLameJsUmdLoaded(): Promise<void> {
  const g = window as any;
  if (g?.lamejs?.Mp3Encoder || g?.Mp3Encoder) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/lamejs@1.2.0/lame.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

function isAlmostSilent(buf: AudioBuffer): boolean {
  try {
    const left = buf.getChannelData(0);
    const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left;
    let peak = 0;
    const len = left.length;
    for (let i = 0; i < len; i += 1024) {
      const l = Math.abs(left[i] || 0);
      const r = Math.abs(right[i] || 0);
      if (l > peak) peak = l;
      if (r > peak) peak = r;
      if (peak > 1e-3) return false;
    }
    return peak < 1e-3;
  } catch {
    return false;
  }
}

async function jsMixToBuffer(
  inputs: (AudioBuffer | any)[],
  gains: number[],
  duration: number,
  sampleRate: number
): Promise<AudioBuffer | null> {
  try {
    console.log("[mixdown] jsMixToBuffer fallback: mixing in JS");
    const length = Math.max(1, Math.ceil(duration * sampleRate));
    const mixL = new Float32Array(length);
    const mixR = new Float32Array(length);

    const coerced: { buf: AudioBuffer; gain: number }[] = [];
    const oc = new OfflineAudioContext(2, 1, sampleRate);
    for (let i = 0; i < inputs.length; i++) {
      const gain = Math.max(0, Math.min(1, gains[i] ?? 0));
      if (gain === 0) {
        console.log(`[mixdown] jsMix: Track ${i} skipped (gain=0)`);
        continue;
      }
      const buf = coerceToAudioBuffer(oc, inputs[i], sampleRate);
      if (!buf) {
        console.log(`[mixdown] jsMix: Track ${i} coercion failed`);
        continue;
      }
      console.log(`[mixdown] jsMix: Track ${i} added, gain=${gain}, length=${buf.length}`);
      coerced.push({ buf, gain });
    }

    console.log(`[mixdown] jsMix: mixing ${coerced.length} tracks`);
    coerced.forEach(({ buf, gain }, idx) => {
      const l = buf.getChannelData(0);
      const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
      const n = Math.min(length, buf.length);
      for (let s = 0; s < n; s++) {
        const prevL = mixL[s] ?? 0;
        const prevR = mixR[s] ?? 0;
        const ll = l[s] ?? 0;
        const rr = r[s] ?? 0;
        mixL[s] = prevL + ll * gain;
        mixR[s] = prevR + rr * gain;
      }
      const peak = checkPeak(l);
      console.log(`[mixdown] jsMix: Track ${idx} peak=${peak.toFixed(4)}`);
    });

    // Normalize with headroom to prevent clipping
    let peak = 0;
    for (let i = 0; i < length; i += 1024) {
      const l = mixL[i] ?? 0;
      const r = mixR[i] ?? 0;
      const p = Math.max(Math.abs(l), Math.abs(r));
      if (p > peak) peak = p;
    }
    console.log(`[mixdown] jsMix: mixed peak=${peak.toFixed(4)}`);

    // Always normalize with -1dB headroom to prevent clipping and inter-sample peaks
    const targetPeak = 0.89125; // -1dB headroom
    if (peak > 0.0001) {
      const scale = Math.min(1.0, targetPeak / peak);
      console.log(
        `[mixdown] jsMix: normalizing by ${scale.toFixed(4)} (peak=${peak.toFixed(4)} -> ${(peak * scale).toFixed(4)})`
      );
      for (let i = 0; i < length; i++) {
        mixL[i] = (mixL[i] ?? 0) * scale;
        mixR[i] = (mixR[i] ?? 0) * scale;
      }
    }

    const outCtx = new OfflineAudioContext(2, length, sampleRate);
    const out = outCtx.createBuffer(2, length, sampleRate);
    out.copyToChannel(mixL, 0);
    if (out.numberOfChannels > 1) {
      out.copyToChannel(mixR, 1);
    }
    console.log(`[mixdown] jsMix: output buffer created, ${out.length} samples`);
    return out;
  } catch (e) {
    console.error("[mixdown] jsMix failed:", e);
    return null;
  }
}

function checkPeak(channel: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < channel.length; i += 1024) {
    const p = Math.abs(channel[i] || 0);
    if (p > peak) peak = p;
  }
  return peak;
}

function normalizeBuffer(buffer: AudioBuffer): AudioBuffer {
  try {
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

    // Find true peak across all samples
    let peak = 0;
    for (let i = 0; i < left.length; i++) {
      const l = Math.abs(left[i] || 0);
      const r = Math.abs(right[i] || 0);
      const p = Math.max(l, r);
      if (p > peak) peak = p;
    }

    console.log(`[mixdown] normalizeBuffer: peak=${peak.toFixed(4)}`);

    // Apply -1dB headroom to prevent clipping and inter-sample peaks
    const targetPeak = 0.89125; // -1dB
    if (peak > 0.0001) {
      const scale = Math.min(1.0, targetPeak / peak);
      console.log(`[mixdown] normalizeBuffer: scaling by ${scale.toFixed(4)}`);

      for (let i = 0; i < left.length; i++) {
        left[i] = (left[i] || 0) * scale;
        if (buffer.numberOfChannels > 1) {
          right[i] = (right[i] || 0) * scale;
        }
      }
    }

    return buffer;
  } catch (e) {
    console.error("[mixdown] normalizeBuffer failed:", e);
    return buffer;
  }
}
