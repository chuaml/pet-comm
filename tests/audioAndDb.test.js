import { describe, expect, it, vi } from 'vitest';
import { triggerButtonSound } from '../src/audio/audioEngine.js';
import { encodeMonoWav } from '../src/audio/wavUtils.js';
import {
  appendActivityLog,
  clearActivityLogs,
  deleteButton,
  initStorage,
  replaceAllData,
  resetStorageForTests,
  saveButtons,
  saveButtonWithAudio,
  saveSettings,
} from '../src/storage/db.js';

describe('audioEngine guards & real IndexedDB persistence', () => {
  it('enforces 100ms split-paw guard, per-button cooldown, and forwards voiceSettings cleanly', () => {
    vi.useFakeTimers();
    const utterances = [];
    const mockSynth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [],
      cancel: vi.fn(),
      speak(u) {
        utterances.push(u);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: mockSynth, configurable: true });

    const btnA = { id: 'btn-a', label: 'Outside', ttsText: 'Outside', hasAudio: false };
    const btnB = { id: 'btn-b', label: 'OK', ttsText: 'Okay', hasAudio: false };
    const voiceSettings = {
      voiceEngine: 'os',
      voiceURI: 'auto',
      ttsPitch: 1.25,
      ttsRate: 0.9,
      ttsVolume: 0.75,
    };

    expect(triggerButtonSound(btnA, { cooldownMs: 400, voiceSettings }).played).toBe(true);
    expect(utterances[0].pitch).toBe(1.25);
    expect(utterances[0].rate).toBe(0.9);
    expect(utterances[0].volume).toBe(0.75);

    const splitPaw = triggerButtonSound(btnB, { cooldownMs: 400, voiceSettings });
    expect(splitPaw).toEqual({ played: false, reason: 'split-paw' });

    vi.advanceTimersByTime(120);

    const cooldownBlocked = triggerButtonSound(btnA, { cooldownMs: 400, voiceSettings });
    expect(cooldownBlocked).toEqual({ played: false, reason: 'cooldown' });

    expect(triggerButtonSound(btnB, { cooldownMs: 400, voiceSettings }).played).toBe(true);
    expect(utterances.map((u) => u.text)).toEqual(['Outside', 'Okay']);
  });

  it('persists buttons, WAV audio blobs, settings, logs, and full restores in real IndexedDB', async () => {
    const seeded = await initStorage();
    expect(seeded.buttons).toHaveLength(14);
    expect(seeded.settings.gridDensity).toBe(16);
    expect(seeded.settings.voiceEngine).toBe('os');

    await saveSettings({
      gridDensity: 20,
      cooldownMs: 750,
      voiceEngine: 'human-pack',
      voiceURI: 'Samantha',
      ttsPitch: 1.35,
      ttsRate: 1.0,
      ttsVolume: 0.85,
    });

    const wavBuffer = encodeMonoWav(new Float32Array([0.2, -0.2, 0.5, -0.5]), 24000);
    const customBtn = {
      id: 'btn-custom-1',
      label: 'Park',
      ttsText: 'Dog Park',
      colorId: 'emerald-green',
      customColor: { bgHex: '#2AA898', fgMode: 'auto', fgHex: '#0B1F3A' },
      iconId: 'paw',
      slotIndex: 14,
      hasAudio: true,
      updatedAt: 9999,
    };
    await saveButtonWithAudio(customBtn, {
      buffer: wavBuffer,
      blob: new Blob([wavBuffer], { type: 'audio/wav' }),
      mimeType: 'audio/wav',
      durationMs: 320,
    });
    await appendActivityLog({ buttonId: 'btn-custom-1', label: 'Park', timestamp: 50000 });

    const reloaded = await initStorage();
    expect(reloaded.settings.gridDensity).toBe(20);
    expect(reloaded.settings.voiceEngine).toBe('human-pack');
    expect(reloaded.settings.voiceURI).toBe('Samantha');
    expect(reloaded.buttons).toHaveLength(15);
    expect(reloaded.audioMap.get('btn-custom-1')?.durationMs).toBe(320);
    expect(reloaded.logs[0].label).toBe('Park');

    await deleteButton('btn-custom-1');
    await clearActivityLogs();
    const afterDelete = await initStorage();
    expect(afterDelete.buttons).toHaveLength(14);
    expect(afterDelete.audioMap.has('btn-custom-1')).toBe(false);
    expect(afterDelete.logs).toHaveLength(0);

    await saveButtons(afterDelete.buttons.slice(0, 2));
    await replaceAllData({
      settings: { gridDensity: 4, cooldownMs: 500 },
      buttons: [customBtn],
      audioEntries: [{ buttonId: customBtn.id, buffer: wavBuffer, mimeType: 'audio/wav', durationMs: 320 }],
      logs: [{ buttonId: customBtn.id, label: 'Park', timestamp: 77777 }],
    });
    const replaced = await initStorage();
    expect(replaced.settings.gridDensity).toBe(4);
    expect(replaced.buttons).toHaveLength(1);
    expect(replaced.audioMap.has(customBtn.id)).toBe(true);
    expect(replaced.logs).toHaveLength(1);
  });

  it('falls back cleanly to in-memory storage when indexedDB is unavailable', async () => {
    await resetStorageForTests();
    vi.stubGlobal('indexedDB', undefined);

    const hydrated = await initStorage();
    expect(hydrated.buttons).toHaveLength(14);
    await saveSettings({ gridDensity: 9, cooldownMs: 500 });
    const check = await initStorage();
    expect(check.settings.gridDensity).toBe(9);
  });
});
