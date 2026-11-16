import { describe, expect, it } from 'vitest';
import {
  downmixToMono,
  encodeMonoWav,
  processAudioBufferToWavBlob,
  resampleLinear,
  trimSilence,
} from '../src/audio/wavUtils.js';

describe('wavUtils audio trimming, resampling & PCM WAV encoding', () => {
  it('strips leading and trailing dead air while keeping speech', () => {
    const sampleRate = 10000;
    const samples = new Float32Array(sampleRate * 2);
    for (let i = 5000; i < 10000; i += 1) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }

    const trimmed = trimSilence(samples, sampleRate, { threshold: 0.02, padMs: 20 });
    expect(trimmed.length).toBeGreaterThan(4800);
    expect(trimmed.length).toBeLessThan(5600);
  });

  it('preserves buffer safely if entire clip is below threshold', () => {
    const quiet = new Float32Array(4000).fill(0.001);
    const trimmed = trimSilence(quiet, 8000, { threshold: 0.05 });
    expect(trimmed).toHaveLength(4000);
  });

  it('halves sample count when downsampling 48kHz to 24kHz', () => {
    const input = new Float32Array(4800);
    for (let i = 0; i < input.length; i += 1) input[i] = i / input.length;
    const resampled = resampleLinear(input, 48000, 24000);
    expect(resampled).toHaveLength(2400);
    expect(resampled[1200]).toBeCloseTo(0.5, 2);
  });

  it('writes valid 44-byte RIFF WAVE PCM header and samples', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const wav = encodeMonoWav(samples, 24000);
    expect(wav.byteLength).toBe(44 + samples.length * 2);

    const view = new DataView(wav);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const format = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(magic).toBe('RIFF');
    expect(format).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(10);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(50, true)).toBe(32767);
    expect(view.getInt16(52, true)).toBe(-32768);
  });

  it('downmixes stereo and returns audio/wav Blob', () => {
    const length = 24000;
    const ch0 = new Float32Array(length);
    const ch1 = new Float32Array(length);
    for (let i = 4000; i < 16000; i += 1) {
      ch0[i] = 0.4;
      ch1[i] = 0.2;
    }
    const fakeBuffer = {
      numberOfChannels: 2,
      sampleRate: 24000,
      length,
      getChannelData: (c) => (c === 0 ? ch0 : ch1),
    };

    const mono = downmixToMono(fakeBuffer);
    expect(mono[5000]).toBeCloseTo(0.3, 5);

    const out = processAudioBufferToWavBlob(fakeBuffer, 24000);
    expect(out.mimeType).toBe('audio/wav');
    expect(out.blob).toBeInstanceOf(Blob);
    expect(out.durationMs).toBeGreaterThanOrEqual(480);
    expect(out.durationMs).toBeLessThanOrEqual(580);
  });
});
