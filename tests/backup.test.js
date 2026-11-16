import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeMonoWav } from '../src/audio/wavUtils.js';
import { parseAndValidateBackup, serializeBackup } from '../src/storage/backup.js';
import { createDefaultButtons } from '../src/utils/defaults.js';

test('serializeBackup and parseAndValidateBackup round-trip 20-slot voice settings, buttons, audio, and logs', async () => {
  const buttons = createDefaultButtons(5000);
  buttons[0].hasAudio = true;

  const wavBuffer = encodeMonoWav(new Float32Array([0.1, -0.2, 0.4, -0.4]), 24000);
  const audioMap = new Map([
    [
      buttons[0].id,
      {
        buttonId: buttons[0].id,
        buffer: wavBuffer,
        blob: new Blob([wavBuffer], { type: 'audio/wav' }),
        mimeType: 'audio/wav',
        durationMs: 250,
      },
    ],
  ]);

  const logs = [{ buttonId: buttons[0].id, label: 'Outside', timestamp: 1700000000000 }];
  const json = await serializeBackup({
    settings: {
      gridDensity: 20,
      cooldownMs: 750,
      voiceURI: 'com.apple.voice.enhanced.en-US.Samantha',
      ttsPitch: 1.35,
      ttsRate: 1.0,
      ttsVolume: 0.85,
    },
    buttons,
    audioMap,
    logs,
  });

  const restored = parseAndValidateBackup(json);
  assert.equal(restored.settings.gridDensity, 20);
  assert.equal(restored.settings.cooldownMs, 750);
  assert.equal(restored.settings.voiceURI, 'com.apple.voice.enhanced.en-US.Samantha');
  assert.equal(restored.settings.ttsPitch, 1.35);
  assert.equal(restored.settings.ttsRate, 1.0);
  assert.equal(restored.settings.ttsVolume, 0.85);
  assert.equal(restored.buttons.length, 14);
  assert.equal(restored.buttons[0].hasAudio, true);
  assert.equal(restored.audioEntries.length, 1);
  assert.equal(restored.audioEntries[0].mimeType, 'audio/wav');
  assert.equal(restored.audioEntries[0].buffer.byteLength, wavBuffer.byteLength);
  assert.equal(restored.logs.length, 1);
});

test('parseAndValidateBackup migrates legacy v1 backups without voice fields and legacy gridDensity', () => {
  const legacyJson = JSON.stringify({
    app: 'pet-comm',
    version: 1,
    settings: { gridDensity: 6, cooldownMs: 500 },
    buttons: [{ id: 'btn-outside', label: 'Outside', iconId: 'door', colorId: 'royal-blue', slotIndex: 0 }],
    activityLog: [],
  });
  const restored = parseAndValidateBackup(legacyJson);
  assert.equal(restored.settings.gridDensity, 9);
  assert.equal(restored.settings.voiceURI, 'auto');
  assert.equal(restored.settings.ttsPitch, 1.2);
  assert.equal(restored.settings.ttsRate, 0.92);
  assert.equal(restored.settings.ttsVolume, 0.8);
});

test('parseAndValidateBackup rejects malformed JSON and invalid versions', () => {
  assert.throws(() => parseAndValidateBackup(''), /empty/i);
  assert.throws(() => parseAndValidateBackup('{not-json'), /not valid JSON/i);
  assert.throws(
    () => parseAndValidateBackup(JSON.stringify({ version: 99, buttons: [] })),
    /Unsupported backup/i
  );
});
