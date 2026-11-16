import assert from 'node:assert/strict';
import test from 'node:test';
import {
  downmixToMono,
  encodeMonoWav,
  processAudioBufferToWavBlob,
  resampleLinear,
  trimSilence,
} from '../src/audio/wavUtils.js';

test('trimSilence strips leading and trailing dead air while keeping speech', () => {
  const sampleRate = 10000;
  const total = sampleRate * 2;
  const samples = new Float32Array(total);
  for (let i = 5000; i < 10000; i += 1) {
    samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }

  const trimmed = trimSilence(samples, sampleRate, { threshold: 0.02, padMs: 20 });
  assert.ok(trimmed.length > 4800 && trimmed.length < 5600, `Unexpected length: ${trimmed.length}`);
});

test('trimSilence preserves buffer safely if entire clip is below threshold', () => {
  const quiet = new Float32Array(4000).fill(0.001);
  const trimmed = trimSilence(quiet, 8000, { threshold: 0.05 });
  assert.equal(trimmed.length, 4000);
});

test('resampleLinear halves sample count when downsampling 48kHz to 24kHz', () => {
  const input = new Float32Array(4800);
  for (let i = 0; i < input.length; i += 1) input[i] = i / input.length;
  const resampled = resampleLinear(input, 48000, 24000);
  assert.equal(resampled.length, 2400);
  assert.ok(Math.abs(resampled[1200] - 0.5) < 0.01);
});

test('encodeMonoWav writes valid 44-byte RIFF WAVE PCM header and samples', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const wav = encodeMonoWav(samples, 24000);
  assert.equal(wav.byteLength, 44 + samples.length * 2);

  const view = new DataView(wav);
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  const format = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  assert.equal(magic, 'RIFF');
  assert.equal(format, 'WAVE');
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 24000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 10);
  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(50, true), 32767);
  assert.equal(view.getInt16(52, true), -32768);
});

test('processAudioBufferToWavBlob downmixes stereo and returns audio/wav Blob', () => {
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
  assert.ok(Math.abs(mono[5000] - 0.3) < 1e-6);

  const out = processAudioBufferToWavBlob(fakeBuffer, 24000);
  assert.equal(out.mimeType, 'audio/wav');
  assert.ok(out.blob instanceof Blob);
  assert.ok(out.durationMs >= 480 && out.durationMs <= 580);
});
