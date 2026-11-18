import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetSpeechWarmupForTests } from '../src/audio/ttsWarmup.js';
import { resetVoicePackLoaderForTests } from '../src/audio/voicePackLoader.js';
import { resetSpeechDiagnosticsForTests } from '../src/state/speechDiagnostics.js';
import { resetStorageForTests } from '../src/storage/db.js';

if (typeof globalThis.SpeechSynthesisUtterance === 'undefined') {
  globalThis.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
    constructor(text = '') {
      this.text = text;
      this.pitch = 1;
      this.rate = 1;
      this.volume = 1;
      this.lang = '';
      this.voice = null;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  };
}

beforeEach(async () => {
  await resetStorageForTests();
  resetVoicePackLoaderForTests();
  resetSpeechWarmupForTests();
  resetSpeechDiagnosticsForTests();
  globalThis.indexedDB = new IDBFactory();
  document.body.innerHTML = '<div id="test-root"></div>';
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.useRealTimers();
});
