/** In-memory record of recent speechSynthesis attempts, shown in Parent Mode only. Never persisted. */
const MAX_ATTEMPTS = 20;

let attempts = [];
let primeStats = { count: 0, lastStartMs: null, slowestStartMs: null, lastError: null };

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function hasBeenActivated() {
  const activation = typeof navigator !== 'undefined' ? navigator.userActivation : null;
  return activation ? Boolean(activation.hasBeenActive) : null;
}

/** Call at press time so `startMs` measures what the listener actually waited. */
export function recordSpeechAttempt(text, voice = null) {
  const attempt = {
    at: Date.now(),
    t0: nowMs(),
    text: String(text || ''),
    voiceName: voice?.name || '(browser default)',
    localService: voice ? Boolean(voice.localService) : null,
    activated: hasBeenActivated(),
    queued: false,
    startMs: null,
    outcome: 'pending',
  };
  attempts = [attempt, ...attempts].slice(0, MAX_ATTEMPTS);
  return attempt;
}

export function markSpeechStarted(attempt) {
  if (!attempt || attempt.startMs !== null) return;
  attempt.startMs = Math.round(nowMs() - attempt.t0);
  attempt.outcome = 'started';
}

/** Outcomes: 'ended', 'superseded', 'merged', or `error:<code>`. A started attempt keeps 'started' on a normal end. */
export function markSpeechOutcome(attempt, outcome) {
  if (!attempt) return;
  if (outcome === 'ended' && attempt.outcome === 'started') return;
  attempt.outcome = outcome;
}

/** Silent warm-up pings are aggregated so they never push real presses out of the list. */
export function recordPrimeResult({ startMs = null, error = null } = {}) {
  primeStats = {
    count: primeStats.count + 1,
    lastStartMs: startMs,
    slowestStartMs:
      startMs === null ? primeStats.slowestStartMs : Math.max(primeStats.slowestStartMs ?? 0, startMs),
    lastError: error || primeStats.lastError,
  };
}

export function getSpeechAttempts() {
  return attempts;
}

export function summarizeSpeechDiagnostics() {
  const started = attempts.filter((a) => a.startMs !== null);
  const failed = attempts.find((a) => a.outcome.startsWith('error:'));
  return {
    attemptCount: attempts.length,
    latestStartMs: started[0]?.startMs ?? null,
    slowestStartMs: started.length ? Math.max(...started.map((a) => a.startMs)) : null,
    lastError: failed ? failed.outcome.slice(6) : null,
    lastVoiceName: attempts[0]?.voiceName ?? null,
    prime: primeStats,
  };
}

function yesNo(value) {
  if (value === null) return 'unknown';
  return value ? 'yes' : 'no';
}

export function formatSpeechReport({ voices = [], settings = {} } = {}) {
  const localCount = voices.filter((v) => v?.localService).length;
  const lines = [
    'Pet Comm speech report',
    `Time: ${new Date().toISOString()}`,
    `Browser: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
    `Voices: ${voices.length} (${localCount} offline) | engine: ${settings.voiceEngine || 'os'} | voice: ${settings.voiceURI || 'auto'}`,
    `Silent warm-ups: ${primeStats.count} | last start: ${primeStats.lastStartMs ?? '-'} ms | slowest: ${primeStats.slowestStartMs ?? '-'} ms | last error: ${primeStats.lastError || 'none'}`,
    `Attempts, newest first (${attempts.length}):`,
  ];
  for (const a of attempts) {
    lines.push(
      `${new Date(a.at).toISOString().slice(11, 19)} "${a.text}" voice=${a.voiceName} offline=${yesNo(a.localService)} activated=${yesNo(a.activated)} queued=${yesNo(a.queued)} start=${a.startMs === null ? '-' : `${a.startMs}ms`} outcome=${a.outcome}`
    );
  }
  return lines.join('\n');
}

export function resetSpeechDiagnosticsForTests() {
  attempts = [];
  primeStats = { count: 0, lastStartMs: null, slowestStartMs: null, lastError: null };
}
