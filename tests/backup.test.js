import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeMonoWav } from '../src/audio/wavUtils.js';
import { parseAndValidateBackup, serializeBackup } from '../src/storage/backup.js';
import { createDefaultButtons } from '../src/utils/defaults.js';

test('serializeBackup and parseAndValidateBackup round-trip buttons, audio blobs, and logs', async () => {
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
    settings: { gridDensity: 6, cooldownMs: 750 },
    buttons,
    audioMap,
    logs,
  });

  const restored = parseAndValidateBackup(json);
  assert.equal(restored.settings.gridDensity, 6);
  assert.equal(restored.settings.cooldownMs, 750);
  assert.equal(restored.buttons.length, 4);
  assert.equal(restored.buttons[0].hasAudio, true);
  assert.equal(restored.audioEntries.length, 1);
  assert.equal(restored.audioEntries[0].mimeType, 'audio/wav');
  assert.equal(restored.audioEntries[0].buffer.byteLength, wavBuffer.byteLength);
  assert.equal(restored.logs.length, 1);
  assert.equal(restored.logs[0].label, 'Outside');
});

test('parseAndValidateBackup rejects malformed JSON and invalid versions', () => {
  assert.throws(() => parseAndValidateBackup(''), /empty/i);
  assert.throws(() => parseAndValidateBackup('{not-json'), /not valid JSON/i);
  assert.throws(
    () => parseAndValidateBackup(JSON.stringify({ version: 99, buttons: [] })),
    /Unsupported backup/i
  );
});
