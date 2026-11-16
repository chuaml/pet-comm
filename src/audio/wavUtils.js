const TARGET_SAMPLE_RATE = 24000;
const MAX_DURATION_SEC = 5;

export function downmixToMono(audioBuffer) {
  const channels = audioBuffer.numberOfChannels || 1;
  const length = audioBuffer.length;
  if (channels === 1) {
    return new Float32Array(audioBuffer.getChannelData(0));
  }
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch += 1) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      mono[i] += data[i] / channels;
    }
  }
  return mono;
}

export function trimSilence(samples, sampleRate, options = {}) {
  const threshold = options.threshold ?? 0.015;
  const windowSize = Math.max(1, Math.floor((sampleRate * (options.windowMs ?? 10)) / 1000));
  const padSamples = Math.floor((sampleRate * (options.padMs ?? 25)) / 1000);
  const fadeSamples = Math.floor((sampleRate * (options.fadeMs ?? 6)) / 1000);
  const maxSamples = Math.floor(sampleRate * MAX_DURATION_SEC);

  if (!samples || samples.length === 0) {
    return new Float32Array(0);
  }

  const capped = samples.length > maxSamples ? samples.subarray(0, maxSamples) : samples;
  const total = capped.length;

  const windowRms = (start) => {
    const end = Math.min(total, start + windowSize);
    if (end <= start) return 0;
    let sumSq = 0;
    for (let i = start; i < end; i += 1) {
      sumSq += capped[i] * capped[i];
    }
    return Math.sqrt(sumSq / (end - start));
  };

  let firstActive = -1;
  for (let i = 0; i < total; i += windowSize) {
    if (windowRms(i) >= threshold) {
      firstActive = i;
      break;
    }
  }

  if (firstActive === -1) {
    return new Float32Array(capped);
  }

  let lastActive = firstActive;
  for (let i = total - windowSize; i >= firstActive; i -= windowSize) {
    if (windowRms(Math.max(0, i)) >= threshold) {
      lastActive = i + windowSize;
      break;
    }
  }

  const sliceStart = Math.max(0, firstActive - padSamples);
  const sliceEnd = Math.min(total, lastActive + padSamples);
  const trimmed = new Float32Array(capped.subarray(sliceStart, sliceEnd));

  const fadeLen = Math.min(fadeSamples, Math.floor(trimmed.length / 4));
  for (let i = 0; i < fadeLen; i += 1) {
    const gain = i / fadeLen;
    trimmed[i] *= gain;
    trimmed[trimmed.length - 1 - i] *= gain;
  }

  return trimmed;
}

export function resampleLinear(samples, srcRate, targetRate = TARGET_SAMPLE_RATE) {
  if (!samples || samples.length === 0 || srcRate === targetRate) {
    return new Float32Array(samples || 0);
  }
  const ratio = srcRate / targetRate;
  const outLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i += 1) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = samples[Math.min(idx, samples.length - 1)];
    const s1 = samples[Math.min(idx + 1, samples.length - 1)];
    out[i] = s0 + (s1 - s0) * frac;
  }
  return out;
}

export function encodeMonoWav(samples, sampleRate = TARGET_SAMPLE_RATE) {
  const numSamples = samples.length;
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const pcm = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
    view.setInt16(offset, pcm, true);
    offset += 2;
  }

  return buffer;
}

export function processAudioBufferToWavBlob(audioBuffer, targetRate = TARGET_SAMPLE_RATE) {
  const mono = downmixToMono(audioBuffer);
  const trimmed = trimSilence(mono, audioBuffer.sampleRate);
  const resampled = resampleLinear(trimmed, audioBuffer.sampleRate, targetRate);
  const buffer = encodeMonoWav(resampled, targetRate);
  const durationMs = Math.round((resampled.length / targetRate) * 1000);
  const blob = new Blob([buffer], { type: 'audio/wav' });

  return {
    blob,
    buffer,
    mimeType: 'audio/wav',
    durationMs,
  };
}
