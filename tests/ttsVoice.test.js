import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBestVoice, scoreSpeechVoice, speakTts } from '../src/audio/ttsVoice.js';
import { matchVoicePresetId, normalizeVoiceSettings } from '../src/utils/presets.js';

test('scoreSpeechVoice and resolveBestVoice prefer natural local human voices over novelty voices', () => {
  const voices = [
    { name: 'Zarvox', voiceURI: 'com.apple.speech.synthesis.voice.Zarvox', lang: 'en-US', localService: true },
    { name: 'Fred', voiceURI: 'com.apple.speech.synthesis.voice.Fred', lang: 'en-US', localService: true },
    { name: 'Thomas', voiceURI: 'fr-FR-thomas', lang: 'fr-FR', localService: true },
    { name: 'Samantha', voiceURI: 'com.apple.voice.compact.en-US.Samantha', lang: 'en-US', localService: true },
    { name: 'Samantha (Enhanced)', voiceURI: 'com.apple.voice.enhanced.en-US.Samantha', lang: 'en-US', localService: true },
  ];

  assert.ok(scoreSpeechVoice(voices[3], 'en-US') > scoreSpeechVoice(voices[0], 'en-US'));
  assert.ok(scoreSpeechVoice(voices[4], 'en-US') > scoreSpeechVoice(voices[3], 'en-US'));

  const autoPicked = resolveBestVoice(voices, 'auto', 'en-US');
  assert.equal(autoPicked?.name, 'Samantha (Enhanced)');

  const explicit = resolveBestVoice(voices, 'com.apple.voice.compact.en-US.Samantha', 'en-US');
  assert.equal(explicit?.name, 'Samantha');

  const missingFallback = resolveBestVoice(voices, 'non-existent-android-voice', 'en-US');
  assert.equal(missingFallback?.name, 'Samantha (Enhanced)');
});

test('speakTts applies Soft & Warm defaults and custom prosody settings to SpeechSynthesisUtterance', (t) => {
  const utterances = [];
  const mockVoice = {
    name: 'Ava (Premium)',
    voiceURI: 'ava-premium',
    lang: 'en-US',
    localService: true,
  };

  globalThis.window = {
    speechSynthesis: {
      getVoices: () => [mockVoice],
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

  assert.equal(speakTts('Okay'), true);
  assert.equal(utterances.length, 1);
  assert.equal(utterances[0].text, 'Okay');
  assert.equal(utterances[0].voice, mockVoice);
  assert.equal(utterances[0].pitch, 1.2);
  assert.equal(utterances[0].rate, 0.92);
  assert.equal(utterances[0].volume, 0.8);

  assert.equal(
    speakTts('Come', { voiceURI: 'auto', ttsPitch: 1.35, ttsRate: 1.0, ttsVolume: 0.85 }),
    true
  );
  assert.equal(utterances[1].pitch, 1.35);
  assert.equal(utterances[1].rate, 1.0);
  assert.equal(utterances[1].volume, 0.85);
});

test('normalizeVoiceSettings clamps out-of-range values and matchVoicePresetId detects presets', () => {
  const normalized = normalizeVoiceSettings({ ttsPitch: 9, ttsRate: 0.1, ttsVolume: -2, voiceURI: '' });
  assert.equal(normalized.voiceURI, 'auto');
  assert.equal(normalized.ttsPitch, 2.0);
  assert.equal(normalized.ttsRate, 0.5);
  assert.equal(normalized.ttsVolume, 0.1);

  assert.equal(matchVoicePresetId({ ttsPitch: 1.2, ttsRate: 0.92, ttsVolume: 0.8 }), 'soft-warm');
  assert.equal(matchVoicePresetId({ ttsPitch: 1.13, ttsRate: 0.92, ttsVolume: 0.8 }), null);
});
