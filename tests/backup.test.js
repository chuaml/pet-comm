import { describe, expect, it } from 'vitest';
import { encodeMonoWav } from '../src/audio/wavUtils.js';
import { parseAndValidateBackup, serializeBackup } from '../src/storage/backup.js';
import { createDefaultButtons } from '../src/utils/defaults.js';

describe('JSON board & audio backup serialization', () => {
  it('round-trips 20-slot voice settings, custom RGB colors, buttons, WAV blobs, and logs', async () => {
    const buttons = createDefaultButtons(5000);
    buttons[0].hasAudio = true;
    buttons[1].customColor = { bgHex: '#2AA898', fgMode: 'custom', fgHex: '#FFFBEB' };

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
    expect(restored.settings).toEqual({
      gridDensity: 20,
      cooldownMs: 750,
      voiceURI: 'com.apple.voice.enhanced.en-US.Samantha',
      ttsPitch: 1.35,
      ttsRate: 1.0,
      ttsVolume: 0.85,
    });
    expect(restored.buttons).toHaveLength(14);
    expect(restored.buttons[0].hasAudio).toBe(true);
    expect(restored.buttons[1].customColor).toEqual({
      bgHex: '#2AA898',
      fgMode: 'custom',
      fgHex: '#FFFBEB',
    });
    expect(restored.audioEntries).toHaveLength(1);
    expect(restored.audioEntries[0].mimeType).toBe('audio/wav');
    expect(restored.audioEntries[0].buffer.byteLength).toBe(wavBuffer.byteLength);
    expect(restored.logs).toHaveLength(1);
  });

  it('migrates legacy v1 backups without voice fields and legacy gridDensity', () => {
    const legacyJson = JSON.stringify({
      app: 'pet-comm',
      version: 1,
      settings: { gridDensity: 6, cooldownMs: 500 },
      buttons: [{ id: 'btn-outside', label: 'Outside', iconId: 'door', colorId: 'royal-blue', slotIndex: 0 }],
      activityLog: [],
    });
    const restored = parseAndValidateBackup(legacyJson);
    expect(restored.settings).toEqual({
      gridDensity: 9,
      cooldownMs: 500,
      voiceURI: 'auto',
      ttsPitch: 1.2,
      ttsRate: 0.92,
      ttsVolume: 0.8,
    });
  });

  it('rejects malformed JSON and unsupported versions', () => {
    expect(() => parseAndValidateBackup('')).toThrow(/empty/i);
    expect(() => parseAndValidateBackup('{not-json')).toThrow(/not valid JSON/i);
    expect(() => parseAndValidateBackup(JSON.stringify({ version: 99, buttons: [] }))).toThrow(
      /Unsupported backup/i
    );
  });
});
