import { DEFAULT_VOICE_SETTINGS, normalizeVoiceSettings } from '../utils/presets.js';

const NOVELTY_VOICE_RE =
  /\b(zarvox|trinoids|whisper|albert|bad news|good news|bells|boing|bubbles|cellos|deranged|hysterical|organ|pipe organ|fred|ralph|junior|bahh|jester|wobble|superstar|espeak|robot|novelty)\b/i;

const QUALITY_MARKER_RE = /\b(natural|neural|premium|enhanced|siri|studio|wavenet)\b/i;

const WARM_HUMAN_VOICE_RE =
  /\b(samantha|ava|allison|karen|moira|tessa|victoria|serena|fiona|zoe|aria|jenny|sonia|libby|natasha|clara|sara|emma|google us english|google uk english female)\b/i;

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

  if (voice.localService) score += 18;
  if (voice.default) score += 6;
  if (QUALITY_MARKER_RE.test(combined)) score += 36;
  if (WARM_HUMAN_VOICE_RE.test(name)) score += 24;
  if (NOVELTY_VOICE_RE.test(name)) score -= 120;

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

export function listAvailableVoices(preferredLang = getPreferredLang()) {
  const synth = getSpeechSynth();
  if (!synth || typeof synth.getVoices !== 'function') return [];
  try {
    return sortVoicesForDisplay(synth.getVoices(), preferredLang);
  } catch {
    return [];
  }
}

export function subscribeVoicesChanged(onChange) {
  const synth = getSpeechSynth();
  if (!synth || typeof onChange !== 'function') return () => {};
  const handler = () => onChange(listAvailableVoices());
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', handler);
    return () => synth.removeEventListener('voiceschanged', handler);
  }
  synth.onvoiceschanged = handler;
  return () => {
    if (synth.onvoiceschanged === handler) synth.onvoiceschanged = null;
  };
}

export function speakTts(text, voiceSettings = DEFAULT_VOICE_SETTINGS) {
  const phrase = String(text || '').trim();
  const synth = getSpeechSynth();
  if (!phrase || !synth || typeof SpeechSynthesisUtterance === 'undefined') {
    return false;
  }
  try {
    const cfg = normalizeVoiceSettings(voiceSettings);
    const utterance = new SpeechSynthesisUtterance(phrase);
    const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
    const selectedVoice = resolveBestVoice(voices, cfg.voiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      if (selectedVoice.lang) utterance.lang = selectedVoice.lang;
    }
    utterance.pitch = cfg.ttsPitch;
    utterance.rate = cfg.ttsRate;
    utterance.volume = cfg.ttsVolume;
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
