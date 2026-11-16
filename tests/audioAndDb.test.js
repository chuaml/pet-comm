import assert from 'node:assert/strict';
import test from 'node:test';
import { triggerButtonSound } from '../src/audio/audioEngine.js';
import { appendActivityLog, clearActivityLogs, initStorage, saveSettings } from '../src/storage/db.js';

test('triggerButtonSound enforces split-paw guard, cooldown, and forwards voiceSettings', async (t) => {
  const utterances = [];
  globalThis.window = {
    speechSynthesis: {
      speaking: false,
      getVoices: () => [],
      cancel() {},
      speak(u) {
        utterances.push(u);
      },
    },
  };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  t.after(() => {
    delete globalThis.window;
    delete globalThis.SpeechSynthesisUtterance;
  });

  const btnA = { id: 'btn-a', label: 'Outside', ttsText: 'Outside', hasAudio: false };
  const btnB = { id: 'btn-b', label: 'OK', ttsText: 'Okay', hasAudio: false };
  const voiceSettings = { voiceURI: 'auto', ttsPitch: 1.25, ttsRate: 0.9, ttsVolume: 0.75 };

  const first = triggerButtonSound(btnA, { cooldownMs: 400, voiceSettings });
  assert.equal(first.played, true);
  assert.equal(utterances[0].pitch, 1.25);
  assert.equal(utterances[0].rate, 0.9);
  assert.equal(utterances[0].volume, 0.75);

  const splitPaw = triggerButtonSound(btnB, { cooldownMs: 400, voiceSettings });
  assert.equal(splitPaw.played, false);
  assert.equal(splitPaw.reason, 'split-paw');

  await new Promise((r) => setTimeout(r, 120));

  const cooldownBlocked = triggerButtonSound(btnA, { cooldownMs: 400, voiceSettings });
  assert.equal(cooldownBlocked.played, false);
  assert.equal(cooldownBlocked.reason, 'cooldown');

  const secondButtonAllowed = triggerButtonSound(btnB, { cooldownMs: 400, voiceSettings });
  assert.equal(secondButtonAllowed.played, true);
  assert.deepEqual(
    utterances.map((u) => u.text),
    ['Outside', 'Okay']
  );
});

test('storage memory fallback seeds 16-slot defaults, persists voice settings, and logs activity', async () => {
  const initial = await initStorage();
  assert.equal(initial.buttons.length, 14);
  assert.equal(initial.settings.gridDensity, 16);
  assert.equal(initial.settings.ttsPitch, 1.2);
  assert.equal(initial.settings.ttsRate, 0.92);
  assert.equal(initial.settings.ttsVolume, 0.8);

  await saveSettings({
    gridDensity: 20,
    cooldownMs: 1000,
    voiceURI: 'Samantha',
    ttsPitch: 1.35,
    ttsRate: 1.0,
    ttsVolume: 0.85,
  });
  await appendActivityLog({ buttonId: 'btn-sit', label: 'Sit', timestamp: 12345 });

  const reloaded = await initStorage();
  assert.equal(reloaded.settings.gridDensity, 20);
  assert.equal(reloaded.settings.voiceURI, 'Samantha');
  assert.equal(reloaded.settings.ttsPitch, 1.35);
  assert.equal(reloaded.logs.length, 1);
  assert.equal(reloaded.logs[0].label, 'Sit');

  await clearActivityLogs();
  const afterClear = await initStorage();
  assert.equal(afterClear.logs.length, 0);
});
