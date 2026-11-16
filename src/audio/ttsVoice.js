import { DEFAULT_VOICE_SETTINGS, normalizeVoiceSettings } from '../utils/presets.js';

const NOVELTY_VOICE_RE =
  /\b(zarvox|trinoids|whisper|albert|bad news|good news|bells|boing|bubbles|cellos|deranged|hysterical|organ|pipe organ|fred|ralph|junior|bahh|jester|wobble|superstar|espeak|robot|novelty)\b/i;

const QUALITY_MARKER_RE = /\b(natural|neural|premium|enhanced|siri|studio|wavenet)\b/i;

const WARM_HUMAN_VOICE_RE =
  /\b(samantha|ava|allison|karen|moira|tessa|victoria|serena|fiona|zoe|aria|jenny|sonia|libby|natasha|clara|sara|emma|google us english|google uk english female)\b/i;

let boundSynth = null;
let cachedSortedVoices = [];
let cachedLang = '';
let activeUtterance = null;
let speakSeq = 0;
let pendingSpeakTimer = null;
let watchdogTimer = null;

function getSpeechSynth() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis || null;
}

export function getPreferredLang() {
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language) {
    return navigator.language;
  }
  if (typeof document !== 'undefined' && document.documentElement?.lang) {
    return document.documentElement.lang;
  }
  return 'en-US';
}

export function scoreSpeechVoice(voice, preferredLang = getPreferredLang()) {
  if (!voice) return -1000;
  const name = String(voice.name || '');
  const uri = String(voice.voiceURI || '');
  const combined = `${name} ${uri}`;
  const voiceLang = String(voice.lang || '').toLowerCase().replace(/_/g, '-');
  const targetLang = String(preferredLang || 'en-US').toLowerCase().replace(/_/g, '-');
  const targetPrimary = targetLang.split('-')[0] || 'en';

  let score = 0;

  if (voiceLang === targetLang) {
    score += 50;
  } else if (voiceLang === targetPrimary || voiceLang.startsWith(`${targetPrimary}-`)) {
    score += 32;
  } else if (voiceLang.startsWith('en')) {
    score += 12;
  } else {
    score -= 60;
  }

  if (voice.localService) score += 90;
  else score -= 50;

  if (voice.default) score += 6;
  if (QUALITY_MARKER_RE.test(combined)) score += 36;
  if (WARM_HUMAN_VOICE_RE.test(name)) score += 24;
  if (NOVELTY_VOICE_RE.test(name)) score -= 160;

  return score;
}

export function sortVoicesForDisplay(voices, preferredLang = getPreferredLang()) {
  if (!Array.isArray(voices) || voices.length === 0) return [];
  return [...voices].sort((a, b) => {
    const diff = scoreSpeechVoice(b, preferredLang) - scoreSpeechVoice(a, preferredLang);
    if (diff !== 0) return diff;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

export function resolveBestVoice(voices, voiceURI = 'auto', preferredLang = getPreferredLang()) {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  if (voiceURI && voiceURI !== 'auto') {
    const explicit = voices.find((v) => v && (v.voiceURI === voiceURI || v.name === voiceURI));
    if (explicit) return explicit;
  }
  return sortVoicesForDisplay(voices, preferredLang)[0] || null;
}

function refreshCachedVoices(synth, preferredLang = getPreferredLang()) {
  if (!synth || typeof synth.getVoices !== 'function') return [];
  try {
    const raw = synth.getVoices() || [];
    cachedSortedVoices = sortVoicesForDisplay(raw, preferredLang);
    boundSynth = synth;
    cachedLang = preferredLang;
    return cachedSortedVoices;
  } catch {
    return [];
  }
}

export function warmSpeechVoices(preferredLang = getPreferredLang()) {
  const synth = getSpeechSynth();
  if (!synth) return [];
  return refreshCachedVoices(synth, preferredLang);
}

export function listAvailableVoices(preferredLang = getPreferredLang()) {
  const synth = getSpeechSynth();
  if (!synth) return [];
  if (synth === boundSynth && cachedLang === preferredLang && cachedSortedVoices.length > 0) {
    return cachedSortedVoices;
  }
  return refreshCachedVoices(synth, preferredLang);
}

export function subscribeVoicesChanged(onChange) {
  const synth = getSpeechSynth();
  if (!synth || typeof onChange !== 'function') return () => {};
  const handler = () => onChange(refreshCachedVoices(synth));
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', handler);
    return () => synth.removeEventListener('voiceschanged', handler);
  }
  synth.onvoiceschanged = handler;
  return () => {
    if (synth.onvoiceschanged === handler) synth.onvoiceschanged = null;
  };
}

function clearTtsTimers() {
  if (pendingSpeakTimer) clearTimeout(pendingSpeakTimer);
  if (watchdogTimer) clearTimeout(watchdogTimer);
  pendingSpeakTimer = null;
  watchdogTimer = null;
}

export function cancelTts() {
  speakSeq += 1;
  clearTtsTimers();
  activeUtterance = null;
  const synth = getSpeechSynth();
  if (!synth) return;
  try {
    if (synth.speaking || synth.pending) synth.cancel();
  } catch {
    // Ignore browser speechSynthesis cancel quirks
  }
}

export function speakTts(text, voiceSettings = DEFAULT_VOICE_SETTINGS, options = {}) {
  const phrase = String(text || '').trim();
  if (!phrase) return false;

  const { onFallback, stallTimeoutMs = 250 } = options;
  const seq = ++speakSeq;
  clearTtsTimers();

  const synth = getSpeechSynth();
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    onFallback?.();
    return false;
  }

  try {
    if (synth.paused && typeof synth.resume === 'function') {
      synth.resume();
    }

    const cfg = normalizeVoiceSettings(voiceSettings);
    const voices = listAvailableVoices();
    const selectedVoice =
      cfg.voiceURI && cfg.voiceURI !== 'auto'
        ? resolveBestVoice(voices, cfg.voiceURI)
        : voices[0] || null;

    const wasBusy = Boolean(synth.speaking || synth.pending);

    const dispatchUtterance = () => {
      if (seq !== speakSeq) return;
      try {
        const utterance = new SpeechSynthesisUtterance(phrase);
        activeUtterance = utterance;
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          if (selectedVoice.lang) utterance.lang = selectedVoice.lang;
        }
        utterance.pitch = cfg.ttsPitch;
        utterance.rate = cfg.ttsRate;
        utterance.volume = cfg.ttsVolume;

        let started = false;
        let fallbackFired = false;
        const fireFallbackOnce = () => {
          if (fallbackFired || started || seq !== speakSeq) return;
          fallbackFired = true;
          onFallback?.();
        };

        if (typeof onFallback === 'function' && stallTimeoutMs > 0) {
          watchdogTimer = setTimeout(fireFallbackOnce, stallTimeoutMs);
          watchdogTimer.unref?.();
        }

        utterance.onstart = () => {
          started = true;
          clearTtsTimers();
        };
        utterance.onend = () => {
          if (activeUtterance === utterance) activeUtterance = null;
          clearTtsTimers();
        };
        utterance.onerror = (ev) => {
          if (activeUtterance === utterance) activeUtterance = null;
          clearTtsTimers();
          const errCode = ev?.error;
          if (errCode !== 'canceled' && errCode !== 'interrupted') fireFallbackOnce();
        };

        synth.speak(utterance);
      } catch {
        onFallback?.();
      }
    };

    if (wasBusy) {
      synth.cancel();
      pendingSpeakTimer = setTimeout(dispatchUtterance, 20);
      pendingSpeakTimer.unref?.();
    } else {
      dispatchUtterance();
    }

    return true;
  } catch {
    onFallback?.();
    return false;
  }
}
