import assert from 'node:assert/strict';
import test from 'node:test';
import { triggerButtonSound } from '../src/audio/audioEngine.js';
import { appendActivityLog, clearActivityLogs, initStorage, saveSettings } from '../src/storage/db.js';

test('triggerButtonSound enforces split-paw guard and per-button cooldown in Node fallback', async (t) => {
  const spoken = [];
  globalThis.window = {
    speechSynthesis: {
      speaking: false,
      cancel() {},
      speak(u) {
        spoken.push(u.text);
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
  const btnB = { id: 'btn-b', label: 'Play', ttsText: 'Play', hasAudio: false };

  const first = triggerButtonSound(btnA, { cooldownMs: 400 });
  assert.equal(first.played, true);

  const splitPaw = triggerButtonSound(btnB, { cooldownMs: 400 });
  assert.equal(splitPaw.played, false);
  assert.equal(splitPaw.reason, 'split-paw');

  await new Promise((r) => setTimeout(r, 120));

  const cooldownBlocked = triggerButtonSound(btnA, { cooldownMs: 400 });
  assert.equal(cooldownBlocked.played, false);
  assert.equal(cooldownBlocked.reason, 'cooldown');

  const secondButtonAllowed = triggerButtonSound(btnB, { cooldownMs: 400 });
  assert.equal(secondButtonAllowed.played, true);
  assert.deepEqual(spoken, ['Outside', 'Play']);
});

test('storage memory fallback seeds defaults, persists settings, and logs activity', async () => {
  const initial = await initStorage();
  assert.equal(initial.buttons.length, 4);
  assert.equal(initial.settings.gridDensity, 4);

  await saveSettings({ gridDensity: 9, cooldownMs: 1000 });
  await appendActivityLog({ buttonId: 'btn-outside', label: 'Outside', timestamp: 12345 });

  const reloaded = await initStorage();
  assert.equal(reloaded.settings.gridDensity, 9);
  assert.equal(reloaded.logs.length, 1);
  assert.equal(reloaded.logs[0].label, 'Outside');

  await clearActivityLogs();
  const afterClear = await initStorage();
  assert.equal(afterClear.logs.length, 0);
});
