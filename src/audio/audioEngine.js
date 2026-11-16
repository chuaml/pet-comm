const SPLIT_PAW_GUARD_MS = 100;

let audioCtx = null;
let activeSource = null;
let activeGain = null;
let pendingAudioMap = new Map();
const decodedBuffers = new Map();
const lastPlayedByButton = new Map();
let lastAnyTriggerAt = -Infinity;
let lastTriggeredButtonId = null;

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

export function ensureAudioContext() {
  if (audioCtx) return audioCtx;
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor({ latencyHint: 'interactive' });
  } catch {
    audioCtx = new Ctor();
  }
  return audioCtx;
}

export function isAudioUnlocked() {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return true;
  return Boolean(audioCtx && audioCtx.state === 'running');
}

export async function decodeRawArrayBuffer(rawBuffer) {
  const ctx = ensureAudioContext();
  if (!ctx || !rawBuffer) return null;
  const copy = rawBuffer.slice(0);
  return ctx.decodeAudioData(copy);
}

export async function cacheButtonAudio(buttonId, audioRecord) {
  if (!audioRecord) {
    decodedBuffers.delete(buttonId);
    pendingAudioMap.delete(buttonId);
    return false;
  }
  pendingAudioMap.set(buttonId, audioRecord);
  const ctx = ensureAudioContext();
  if (!ctx) return false;

  try {
    const rawBuffer = audioRecord.buffer || (await audioRecord.blob.arrayBuffer());
    const decoded = await decodeRawArrayBuffer(rawBuffer);
    if (decoded) {
      decodedBuffers.set(buttonId, decoded);
      return true;
    }
  } catch (err) {
    console.warn(`Failed to decode audio for ${buttonId}:`, err);
  }
  return false;
}

export function removeCachedAudio(buttonId) {
  decodedBuffers.delete(buttonId);
  pendingAudioMap.delete(buttonId);
}

export async function preloadAllAudio(audioMap) {
  pendingAudioMap = new Map(audioMap);
  decodedBuffers.clear();
  const tasks = [];
  for (const [buttonId, record] of audioMap.entries()) {
    tasks.push(cacheButtonAudio(buttonId, record));
  }
  await Promise.allSettled(tasks);
}

export async function unlockAudioEngine() {
  const ctx = ensureAudioContext();
  if (ctx) {
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Ignore; user can tap again if gesture was not recognized
      }
    }
    try {
      const silent = ctx.createBuffer(1, 1, ctx.sampleRate || 24000);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Ignore silent warm-up failures
    }
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (!window.speechSynthesis.speaking) {
        const warmup = new SpeechSynthesisUtterance('');
        warmup.volume = 0;
        window.speechSynthesis.speak(warmup);
      }
    } catch {
      // Ignore Safari/WebView speechSynthesis quirks
    }
  }

  for (const [buttonId, record] of pendingAudioMap.entries()) {
    if (!decodedBuffers.has(buttonId)) {
      await cacheButtonAudio(buttonId, record);
    }
  }

  return isAudioUnlocked();
}

export function stopActiveAudio() {
  const ctx = audioCtx;
  if (activeSource && ctx) {
    try {
      const now = ctx.currentTime;
      if (activeGain) {
        activeGain.gain.cancelScheduledValues(now);
        activeGain.gain.setValueAtTime(activeGain.gain.value, now);
        activeGain.gain.linearRampToValueAtTime(0.0001, now + 0.008);
      }
      activeSource.stop(now + 0.009);
    } catch {
      try {
        activeSource.stop();
      } catch {
        // Already stopped
      }
    }
    activeSource = null;
    activeGain = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

function playDecodedBuffer(audioBuffer) {
  const ctx = ensureAudioContext();
  if (!ctx || !audioBuffer) return false;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = audioBuffer;
  gain.gain.setValueAtTime(1, ctx.currentTime);
  source.connect(gain);
  gain.connect(ctx.destination);

  activeSource = source;
  activeGain = gain;
  source.onended = () => {
    if (activeSource === source) {
      activeSource = null;
      activeGain = null;
    }
  };
  source.start(0);
  return true;
}

export function speakTtsFallback(text) {
  const phrase = String(text || '').trim();
  if (!phrase || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  try {
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function triggerButtonSound(button, options = {}) {
  if (!button) return { played: false, reason: 'empty' };

  const now = performance.now();
  const cooldownMs = options.cooldownMs ?? 500;
  const bypassGuards = Boolean(options.bypassGuards);

  if (!bypassGuards) {
    if (
      button.id !== lastTriggeredButtonId &&
      now - lastAnyTriggerAt < SPLIT_PAW_GUARD_MS
    ) {
      return { played: false, reason: 'split-paw' };
    }
    const prevTime = lastPlayedByButton.get(button.id) ?? -Infinity;
    if (now - prevTime < cooldownMs) {
      return { played: false, reason: 'cooldown' };
    }
    lastAnyTriggerAt = now;
    lastTriggeredButtonId = button.id;
    lastPlayedByButton.set(button.id, now);
  }

  stopActiveAudio();

  const cached = button.hasAudio ? decodedBuffers.get(button.id) : null;
  if (cached && playDecodedBuffer(cached)) {
    return { played: true, mode: 'buffer' };
  }

  const spoke = speakTtsFallback(button.ttsText || button.label);
  return { played: spoke, mode: 'tts' };
}

export async function previewAudioPayload(audioPayload, fallbackText) {
  stopActiveAudio();
  if (audioPayload && (audioPayload.buffer || audioPayload.blob)) {
    try {
      const raw = audioPayload.buffer || (await audioPayload.blob.arrayBuffer());
      const decoded = await decodeRawArrayBuffer(raw);
      if (decoded && playDecodedBuffer(decoded)) return true;
    } catch {
      // Fall back to TTS below
    }
  }
  return speakTtsFallback(fallbackText);
}
