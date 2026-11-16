import { describe, expect, it, vi } from 'vitest';
import {
  cancelTts,
  hasSystemVoices,
  resolveBestVoice,
  scoreSpeechVoice,
  speakTts,
} from '../src/audio/ttsVoice.js';
import { matchVoicePresetId, normalizeVoiceSettings } from '../src/utils/presets.js';

describe('ttsVoice local-first ranking & race-free speech synthesis', () => {
  it('prioritizes local offline OS voices over remote cloud streaming voices and novelty voices', () => {
    const voices = [
      { name: 'Zarvox', voiceURI: 'com.apple.speech.synthesis.voice.Zarvox', lang: 'en-US', localService: true },
      { name: 'Google US English', voiceURI: 'Google US English', lang: 'en-US', localService: false },
      { name: 'Microsoft Ava Online (Natural)', voiceURI: 'ava-cloud', lang: 'en-US', localService: false },
      { name: 'Samantha', voiceURI: 'com.apple.voice.compact.en-US.Samantha', lang: 'en-US', localService: true },
      { name: 'Samantha (Enhanced)', voiceURI: 'com.apple.voice.enhanced.en-US.Samantha', lang: 'en-US', localService: true },
    ];

    expect(scoreSpeechVoice(voices[3], 'en-US')).toBeGreaterThan(scoreSpeechVoice(voices[1], 'en-US'));
    expect(scoreSpeechVoice(voices[3], 'en-US')).toBeGreaterThan(scoreSpeechVoice(voices[2], 'en-US'));
    expect(scoreSpeechVoice(voices[4], 'en-US')).toBeGreaterThan(scoreSpeechVoice(voices[3], 'en-US'));
    expect(scoreSpeechVoice(voices[3], 'en-US')).toBeGreaterThan(scoreSpeechVoice(voices[0], 'en-US'));

    expect(resolveBestVoice(voices, 'auto', 'en-US')?.name).toBe('Samantha (Enhanced)');
    expect(resolveBestVoice(voices, 'ava-cloud', 'en-US')?.name).toBe('Microsoft Ava Online (Natural)');
  });

  it('avoids idle cancel() race, resumes paused synth, delays 20ms when busy, and detects 0-voice OS', () => {
    vi.useFakeTimers();
    const utterances = [];
    const cancelSpy = vi.fn();
    const resumeSpy = vi.fn(function onResume() {
      this.paused = false;
    });
    const mockVoice = { name: 'Samantha', voiceURI: 'samantha-local', lang: 'en-US', localService: true };

    const mockSynth = {
      speaking: false,
      pending: false,
      paused: true,
      getVoices: () => [mockVoice],
      cancel: cancelSpy,
      resume: resumeSpy,
      speak(u) {
        utterances.push(u);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: mockSynth, configurable: true });

    expect(hasSystemVoices()).toBe(true);
    expect(speakTts('Okay')).toBe(true);
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(resumeSpy).toHaveBeenCalledTimes(1);
    expect(utterances[0].pitch).toBe(1.2);
    expect(utterances[0].rate).toBe(0.92);
    expect(utterances[0].volume).toBe(0.8);

    // Busy cutover waits 20ms after cancel() before speaking
    mockSynth.speaking = true;
    speakTts('Water');
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(utterances).toHaveLength(1);

    vi.advanceTimersByTime(20);
    expect(utterances).toHaveLength(2);
    expect(utterances[1].text).toBe('Water');

    cancelTts();

    // 0-voice detection on OS without speech-dispatcher
    Object.defineProperty(window, 'speechSynthesis', {
      value: { getVoices: () => [] },
      configurable: true,
    });
    expect(hasSystemVoices()).toBe(false);
  });

  it('clamps out-of-range settings, defaults voiceEngine to os, and matches voice presets', () => {
    const normalized = normalizeVoiceSettings({ ttsPitch: 9, ttsRate: 0.1, ttsVolume: -2, voiceURI: '' });
    expect(normalized).toEqual({
      voiceEngine: 'os',
      voiceURI: 'auto',
      ttsPitch: 2.0,
      ttsRate: 0.5,
      ttsVolume: 0.1,
    });
    expect(normalizeVoiceSettings({ voiceEngine: 'human-pack' }).voiceEngine).toBe('human-pack');
    expect(matchVoicePresetId({ ttsPitch: 1.2, ttsRate: 0.92, ttsVolume: 0.8 })).toBe('soft-warm');
    expect(matchVoicePresetId({ ttsPitch: 1.13, ttsRate: 0.92, ttsVolume: 0.8 })).toBeNull();
  });
});
