import {
  markSpeechOutcome,
  markSpeechStarted,
  recordPrimeResult,
} from '../state/speechDiagnostics.js';

/** How often a silent utterance keeps the OS speech engine loaded while Pet Mode idles. */
export const KEEP_WARM_INTERVAL_MS = 60_000;
/** A queued press stops waiting for a silent engine after this long and forces a restart. */
export const STALL_TIMEOUT_MS = 30_000;
const POLL_MS = 250;
const PRIMER_TEXT = 'a';

let inFlight = null;
let waiter = null;
let pollTimer = null;

function getSynth() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis || null;
}

function isBusy(synth) {
  return Boolean(synth && (synth.speaking || synth.pending));
}

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function settle(reason) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  const cb = waiter;
  waiter = null;
  cb?.(reason, inFlight && !inFlight.primer ? inFlight.text : null);
}

/**
 * Speaks an utterance and tracks whether the engine has actually started it.
 * Pass `attempt` for a real press; omit it for a silent primer.
 */
export function submitUtterance(synth, utterance, { attempt = null, onDone } = {}) {
  const flight = { utterance, text: utterance.text, started: false, primer: !attempt };
  const t0 = nowMs();
  let startMs = null;

  const finish = (outcome) => {
    if (attempt) markSpeechOutcome(attempt, outcome);
    else recordPrimeResult({ startMs, error: outcome.startsWith('error:') ? outcome.slice(6) : null });
    onDone?.();
    if (inFlight !== flight) return;
    inFlight = null;
    settle(outcome === 'ended' ? 'end' : 'error');
  };

  utterance.onstart = () => {
    flight.started = true;
    startMs = Math.round(nowMs() - t0);
    markSpeechStarted(attempt);
    if (inFlight === flight) settle('start');
  };
  utterance.onend = () => finish('ended');
  utterance.onerror = (e) => finish(`error:${e?.error || 'unknown'}`);

  inFlight = flight;
  synth.speak(utterance);
}

/** True while an utterance is queued on an engine that has not begun speaking it (cold start). */
export function isSpeechUnstarted(synth = getSynth()) {
  return Boolean(inFlight && !inFlight.started && isBusy(synth));
}

export function isPrimerUnstarted(synth = getSynth()) {
  return isSpeechUnstarted(synth) && inFlight.primer;
}

/**
 * Latest-wins: runs `cb(reason, inFlightText)` once the in-flight utterance starts, ends, errors,
 * the synth goes idle without events, or the stall timeout passes. Never calls `cancel()` itself.
 */
export function deferUntilSpeechSettles(synth, cb) {
  if (waiter) settle('replaced');
  waiter = cb;
  const since = nowMs();
  pollTimer = setInterval(() => {
    if (!isBusy(synth)) settle('idle');
    else if (nowMs() - since >= STALL_TIMEOUT_MS) settle('stall');
  }, POLL_MS);
  pollTimer.unref?.();
}

/** Called when speech is cancelled outright: drops any waiting press and forgets the in-flight utterance. */
export function dropSpeechWaiter() {
  inFlight = null;
  if (waiter) settle('dropped');
}

/**
 * Wakes the OS speech engine with a volume-0 utterance so the next real word is not delayed.
 * Call synchronously inside a user gesture when possible. Never interrupts active speech.
 */
export function primeSpeechEngine({ requireVoices = false } = {}) {
  const synth = getSynth();
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
  if (isBusy(synth)) return false;
  try {
    if (requireVoices && !(synth.getVoices?.() || []).length) return false;
    const utterance = new SpeechSynthesisUtterance(PRIMER_TEXT);
    utterance.volume = 0;
    utterance.rate = 2;
    submitUtterance(synth, utterance);
    return true;
  } catch {
    return false;
  }
}

function pageWasActivated() {
  const activation = typeof navigator !== 'undefined' ? navigator.userActivation : null;
  return activation ? Boolean(activation.hasBeenActive) : true;
}

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

/** Keeps the OS speech engine warm while Pet Mode is visible and the OS voice is the active engine. */
export function createSpeechWarmActions(state) {
  let timer = null;
  let active = false;

  const ping = () => {
    if (pageWasActivated()) primeSpeechEngine({ requireVoices: true });
  };

  return {
    /** Safe to call on every render: only reacts when mode, engine, or visibility changed. */
    syncSpeechWarm() {
      const shouldRun =
        state.mode === 'pet' && state.settings?.voiceEngine !== 'human-pack' && isDocumentVisible();
      if (shouldRun === active) return;
      active = shouldRun;
      if (timer) clearInterval(timer);
      timer = null;
      if (!active) return;
      ping();
      timer = setInterval(ping, KEEP_WARM_INTERVAL_MS);
      timer.unref?.();
    },
  };
}

export function resetSpeechWarmupForTests() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  inFlight = null;
  waiter = null;
}
