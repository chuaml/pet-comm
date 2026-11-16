export const VOICE_PRESETS = Object.freeze([
  {
    id: 'soft-warm',
    name: 'Soft & Warm',
    description: 'Higher, gentler tone',
    pitch: 1.2,
    rate: 0.92,
    volume: 0.8,
  },
  {
    id: 'cheerful',
    name: 'Cheerful',
    description: 'Bright & upbeat',
    pitch: 1.35,
    rate: 1.0,
    volume: 0.85,
  },
  {
    id: 'calm',
    name: 'Calm & Gentle',
    description: 'Slow & soothing',
    pitch: 1.05,
    rate: 0.85,
    volume: 0.75,
  },
  {
    id: 'neutral',
    name: 'Natural',
    description: 'Unmodified voice',
    pitch: 1.0,
    rate: 1.0,
    volume: 1.0,
  },
]);

export const DEFAULT_VOICE_SETTINGS = Object.freeze({
  voiceURI: 'auto',
  ttsPitch: 1.2,
  ttsRate: 0.92,
  ttsVolume: 0.8,
});

export const VOICE_SAMPLE_WORDS = Object.freeze(['Play', 'Sit', 'Okay', 'Water', 'Come']);

function clampRounded(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.min(Math.max(num, min), max);
  return Math.round(clamped * 100) / 100;
}

export function normalizeVoiceSettings(raw) {
  const rawUri = typeof raw?.voiceURI === 'string' ? raw.voiceURI.trim().slice(0, 160) : '';
  return {
    voiceURI: rawUri || DEFAULT_VOICE_SETTINGS.voiceURI,
    ttsPitch: clampRounded(raw?.ttsPitch, 0.5, 2.0, DEFAULT_VOICE_SETTINGS.ttsPitch),
    ttsRate: clampRounded(raw?.ttsRate, 0.5, 2.0, DEFAULT_VOICE_SETTINGS.ttsRate),
    ttsVolume: clampRounded(raw?.ttsVolume, 0.1, 1.0, DEFAULT_VOICE_SETTINGS.ttsVolume),
  };
}

export function matchVoicePresetId(settings) {
  if (!settings) return null;
  const found = VOICE_PRESETS.find(
    (p) =>
      Math.abs(p.pitch - settings.ttsPitch) < 0.011 &&
      Math.abs(p.rate - settings.ttsRate) < 0.011 &&
      Math.abs(p.volume - settings.ttsVolume) < 0.011
  );
  return found ? found.id : null;
}

export const BUTTON_TYPE_PRESETS = Object.freeze([
  { id: 'outside', label: 'Outside', ttsText: 'Outside', iconId: 'door', colorId: 'royal-blue' },
  { id: 'eat', label: 'Eat', ttsText: 'Eat', iconId: 'bowl', colorId: 'warm-amber' },
  { id: 'water', label: 'Water', ttsText: 'Water', iconId: 'water', colorId: 'sky-cyan' },
  { id: 'treat', label: 'Treat', ttsText: 'Treat', iconId: 'bone', colorId: 'vivid-purple' },
  { id: 'play', label: 'Play', ttsText: 'Play', iconId: 'paw', colorId: 'bright-yellow' },
  { id: 'ball', label: 'Ball', ttsText: 'Ball', iconId: 'ball', colorId: 'teal-mint' },
  { id: 'frisbee', label: 'Frisbee', ttsText: 'Frisbee', iconId: 'frisbee', colorId: 'tangerine' },
  { id: 'come', label: 'Come', ttsText: 'Come', iconId: 'come', colorId: 'indigo-night' },
  { id: 'sit', label: 'Sit', ttsText: 'Sit', iconId: 'sit', colorId: 'aqua-ice' },
  { id: 'stay', label: 'Stay', ttsText: 'Stay', iconId: 'stay', colorId: 'rose-berry' },
  { id: 'up', label: 'Up', ttsText: 'Up', iconId: 'up', colorId: 'fresh-lime' },
  { id: 'down', label: 'Down', ttsText: 'Down', iconId: 'down', colorId: 'soft-lavender' },
  { id: 'ok', label: 'OK', ttsText: 'Okay', iconId: 'ok', colorId: 'emerald-green' },
  { id: 'no', label: 'No', ttsText: 'No', iconId: 'no', colorId: 'coral-red' },
]);

export function getButtonPreset(presetId) {
  return BUTTON_TYPE_PRESETS.find((p) => p.id === presetId) || null;
}

export function matchButtonPresetId(draft) {
  if (!draft || !draft.label) return null;
  const cleanLabel = String(draft.label).trim().toLowerCase();
  const match = BUTTON_TYPE_PRESETS.find(
    (p) => p.label.toLowerCase() === cleanLabel && p.iconId === draft.iconId
  );
  return match ? match.id : null;
}
