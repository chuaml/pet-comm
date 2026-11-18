import { render } from 'lit-html';
import { describe, expect, it, vi } from 'vitest';
import { cancelTts, speakTts } from '../src/audio/ttsVoice.js';
import {
  createSpeechWarmActions,
  KEEP_WARM_INTERVAL_MS,
  primeSpeechEngine,
  STALL_TIMEOUT_MS,
} from '../src/audio/ttsWarmup.js';
import {
  formatSpeechReport,
  getSpeechAttempts,
  summarizeSpeechDiagnostics,
} from '../src/state/speechDiagnostics.js';
import { speechDiagnosticsView } from '../src/ui/speechDiagnosticsView.js';
import { DEFAULT_SETTINGS } from '../src/utils/defaults.js';

/** A synth whose engine only starts an utterance when the test says so (cold start). */
function installColdSynth() {
  const spoken = [];
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [{ name: 'Samantha', voiceURI: 'samantha', lang: 'en-US', localService: true }],
    cancel: vi.fn(() => {
      synth.speaking = false;
    }),
    speak(u) {
      spoken.push(u);
      synth.speaking = true;
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  const start = (u) => u.onstart();
  const end = (u) => {
    synth.speaking = false;
    u.onend();
  };
  return { synth, spoken, start, end };
}

describe('speech engine cold start handling', () => {
  it('never cancels an utterance the engine has not started, and speaks only the latest press', () => {
    vi.useFakeTimers();
    const { synth, spoken, start } = installColdSynth();

    speakTts('Outside');
    speakTts('Eat');
    speakTts('Water');
    vi.advanceTimersByTime(10_000);

    // Engine still cold: one request in flight, no cancel() churn, later presses held back
    expect(spoken.map((u) => u.text)).toEqual(['Outside']);
    expect(synth.cancel).not.toHaveBeenCalled();

    // Engine wakes: the stale word is cut over to the latest press exactly once
    start(spoken[0]);
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20);
    expect(spoken.map((u) => u.text)).toEqual(['Outside', 'Water']);

    const outcomes = Object.fromEntries(getSpeechAttempts().map((a) => [a.text, a.outcome]));
    expect(outcomes.Eat).toBe('superseded');
    expect(getSpeechAttempts().find((a) => a.text === 'Water').queued).toBe(true);
  });

  it('lets a repeated press of the same word play through without a restart', () => {
    vi.useFakeTimers();
    const { synth, spoken, start } = installColdSynth();

    speakTts('Outside');
    speakTts('Outside');
    start(spoken[0]);
    vi.advanceTimersByTime(100);

    expect(spoken).toHaveLength(1);
    expect(synth.cancel).not.toHaveBeenCalled();
    expect(getSpeechAttempts()[0].outcome).toBe('merged');
  });

  it('speaks the queued press when the synth goes idle without events, and restarts after a stall', () => {
    vi.useFakeTimers();
    const { synth, spoken } = installColdSynth();

    // Platform that never fires utterance events: the poll notices the synth went idle
    speakTts('Sit');
    speakTts('Stay');
    synth.speaking = false;
    vi.advanceTimersByTime(300);
    expect(spoken.map((u) => u.text)).toEqual(['Sit', 'Stay']);
    expect(synth.cancel).not.toHaveBeenCalled();

    // Engine never responds at all: after the stall timeout, fall back to cancel + re-speak
    speakTts('Come');
    vi.advanceTimersByTime(STALL_TIMEOUT_MS + 300);
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(spoken.at(-1).text).toBe('Come');
  });

  it('records start latency and error codes instead of discarding them', () => {
    vi.useFakeTimers();
    const { spoken, start, end } = installColdSynth();

    speakTts('Play');
    vi.advanceTimersByTime(18_000);
    start(spoken[0]);
    end(spoken[0]);
    speakTts('Ball');
    spoken[1].onerror({ error: 'not-allowed' });

    const summary = summarizeSpeechDiagnostics();
    expect(summary.slowestStartMs).toBeGreaterThanOrEqual(18_000);
    expect(summary.lastError).toBe('not-allowed');
    expect(summary.lastVoiceName).toBe('Samantha');
    const report = formatSpeechReport({ voices: [], settings: DEFAULT_SETTINGS });
    expect(report).toContain('"Play"');
    expect(report).toContain('outcome=error:not-allowed');
  });
});

describe('silent priming and keep-warm', () => {
  it('primes at volume 0, never interrupts speech, and survives cancelTts while unstarted', () => {
    const { synth, spoken, start, end } = installColdSynth();

    expect(primeSpeechEngine()).toBe(true);
    expect(spoken[0].volume).toBe(0);
    expect(primeSpeechEngine()).toBe(false);

    // Stopping audio must not cancel a warm-up that is still waking the engine
    cancelTts();
    expect(synth.cancel).not.toHaveBeenCalled();

    start(spoken[0]);
    end(spoken[0]);
    expect(summarizeSpeechDiagnostics().prime.count).toBe(1);
    expect(getSpeechAttempts()).toHaveLength(0);

    Object.defineProperty(window, 'speechSynthesis', {
      value: { speaking: false, pending: false, getVoices: () => [], speak: vi.fn() },
      configurable: true,
    });
    expect(primeSpeechEngine({ requireVoices: true })).toBe(false);
  });

  it('pings only in visible Pet Mode with the OS engine, and never while speaking', () => {
    vi.useFakeTimers();
    const { synth, spoken, start, end } = installColdSynth();
    const state = { mode: 'parent', settings: { ...DEFAULT_SETTINGS } };
    const warm = createSpeechWarmActions(state);

    warm.syncSpeechWarm();
    vi.advanceTimersByTime(KEEP_WARM_INTERVAL_MS * 2);
    expect(spoken).toHaveLength(0);

    state.mode = 'pet';
    warm.syncSpeechWarm();
    expect(spoken).toHaveLength(1);
    start(spoken[0]);
    end(spoken[0]);

    // Repeated syncs (every render) do not re-ping; the interval does
    warm.syncSpeechWarm();
    expect(spoken).toHaveLength(1);
    vi.advanceTimersByTime(KEEP_WARM_INTERVAL_MS);
    expect(spoken).toHaveLength(2);
    end(spoken[1]);

    // Busy synth: the ping is skipped, never cancelled
    synth.speaking = true;
    vi.advanceTimersByTime(KEEP_WARM_INTERVAL_MS);
    expect(spoken).toHaveLength(2);
    expect(synth.cancel).not.toHaveBeenCalled();
    synth.speaking = false;

    // Human Voice Pack engine or leaving Pet Mode stops the pings
    state.settings.voiceEngine = 'human-pack';
    warm.syncSpeechWarm();
    vi.advanceTimersByTime(KEEP_WARM_INTERVAL_MS * 3);
    expect(spoken).toHaveLength(2);
  });

  it('does not ping before the page has ever been activated', () => {
    vi.useFakeTimers();
    const { spoken } = installColdSynth();
    Object.defineProperty(navigator, 'userActivation', {
      value: { hasBeenActive: false },
      configurable: true,
    });
    try {
      const warm = createSpeechWarmActions({ mode: 'pet', settings: { ...DEFAULT_SETTINGS } });
      warm.syncSpeechWarm();
      vi.advanceTimersByTime(KEEP_WARM_INTERVAL_MS);
      expect(spoken).toHaveLength(0);
      warm.syncSpeechWarm();
    } finally {
      delete navigator.userActivation;
    }
  });
});

describe('speech diagnostics view', () => {
  it('renders latency, last error and a copyable report in the voice dialog section', () => {
    vi.useFakeTimers();
    const { spoken, start } = installColdSynth();
    speakTts('Treat');
    vi.advanceTimersByTime(2500);
    start(spoken[0]);

    const actions = { onRefreshSpeechDiagnostics: vi.fn(), onCopySpeechReport: vi.fn() };
    const state = { settings: { ...DEFAULT_SETTINGS }, availableVoices: [], speechReportStatus: 'Report copied.' };
    render(speechDiagnosticsView(state, actions), document.getElementById('test-root'));

    const root = document.querySelector('.speech-diag');
    expect(root.textContent).toContain('2.5 s');
    expect(root.textContent).toContain('Report copied.');
    expect(root.querySelector('.speech-diag-report').value).toContain('"Treat"');
    root.querySelector('.slot-btn').click();
    expect(actions.onCopySpeechReport).toHaveBeenCalledTimes(1);
  });
});
