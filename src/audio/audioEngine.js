import { normalizeVoiceSettings } from '../utils/presets.js';
import { cancelTts, speakTts, warmSpeechVoices } from './ttsVoice.js';
import { ensureVoicePackDecoded, playHumanVoicePackPhrase } from './voicePackLoader.js';

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

export function resumeAudioContextSync() {
  const ctx = ensureAudioContext();
  if (!ctx) return Promise.resolve(true);
  if (ctx.state === 'suspended') {
    return ctx
      .resume()
      .then(() => isAudioUnlocked())
      .catch(() => false);
  }
  return Promise.resolve(isAudioUnlocked());
}

export async function decodeRawArrayBuffer(rawBuffer) {
  const ctx = ensureAudioContext();
  if (!ctx || !rawBuffer) return null;
  return ctx.decodeAudioData(rawBuffer.slice(0));
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
  warmSpeechVoices();
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

  for (const [buttonId, record] of pendingAudioMap.entries()) {
    if (!decodedBuffers.has(buttonId)) await cacheButtonAudio(buttonId, record);
  }
  await ensureVoicePackDecoded(decodeRawArrayBuffer);
  return isAudioUnlocked();
}

function stopActiveBufferOnly() {
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
}

export function stopActiveAudio() {
  stopActiveBufferOnly();
  cancelTts();
}

function playDecodedBuffer(audioBuffer, tuneSettings = null) {
  const ctx = ensureAudioContext();
  if (!ctx || !audioBuffer) return false;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = audioBuffer;

  const now = ctx.currentTime || 0;
  gain.gain.setValueAtTime(tuneSettings ? tuneSettings.ttsVolume : 1, now);

  if (tuneSettings) {
    source.playbackRate?.setValueAtTime?.(tuneSettings.ttsRate, now);
    const cents = Math.round((tuneSettings.ttsPitch - 1.1) * 350);
    source.detune?.setValueAtTime?.(cents, now);
  }

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

function tryPlayVoicePack(phrase, voiceSettings) {
  const cfg = normalizeVoiceSettings(voiceSettings);
  return playHumanVoicePackPhrase(phrase, cfg, playDecodedBuffer, decodeRawArrayBuffer, cancelTts);
}

export function speakTtsFallback(text, voiceSettings) {
  if (tryPlayVoicePack(text, voiceSettings)) return true;
  return speakTts(text, voiceSettings);
}

export function triggerButtonSound(button, options = {}) {
  if (!button) return { played: false, reason: 'empty' };

  const now = performance.now();
  const cooldownMs = options.cooldownMs ?? 500;
  if (!options.bypassGuards) {
    if (button.id !== lastTriggeredButtonId && now - lastAnyTriggerAt < SPLIT_PAW_GUARD_MS) {
      return { played: false, reason: 'split-paw' };
    }
    const prevTime = lastPlayedByButton.get(button.id) ?? -Infinity;
    if (now - prevTime < cooldownMs) return { played: false, reason: 'cooldown' };
    lastAnyTriggerAt = now;
    lastTriggeredButtonId = button.id;
    lastPlayedByButton.set(button.id, now);
  }

  stopActiveBufferOnly();

  const cached = button.hasAudio ? decodedBuffers.get(button.id) : null;
  if (cached && playDecodedBuffer(cached)) {
    cancelTts();
    return { played: true, mode: 'buffer' };
  }

  const phrase = button.ttsText || button.label;
  if (tryPlayVoicePack(phrase, options.voiceSettings)) {
    return { played: true, mode: 'human-pack' };
  }

  return { played: speakTts(phrase, options.voiceSettings), mode: 'tts' };
}

export async function previewAudioPayload(audioPayload, fallbackText, voiceSettings) {
  stopActiveBufferOnly();
  if (audioPayload && (audioPayload.buffer || audioPayload.blob)) {
    try {
      const raw = audioPayload.buffer || (await audioPayload.blob.arrayBuffer());
      const decoded = await decodeRawArrayBuffer(raw);
      if (decoded && playDecodedBuffer(decoded)) {
        cancelTts();
        return true;
      }
    } catch {
      // Fall back below
    }
  }
  return speakTtsFallback(fallbackText, voiceSettings);
}
