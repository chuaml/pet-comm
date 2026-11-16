import { BUTTON_TYPE_PRESETS, DEFAULT_VOICE_SETTINGS, normalizeVoiceSettings } from './presets.js';

export const GRID_DENSITIES = [4, 9, 12, 16, 20];
export const COOLDOWN_OPTIONS = [250, 500, 750, 1000, 1500];

export const DEFAULT_SETTINGS = Object.freeze({
  gridDensity: 16,
  cooldownMs: 500,
  ...DEFAULT_VOICE_SETTINGS,
});

export function normalizeGridDensity(density) {
  if (GRID_DENSITIES.includes(density)) return density;
  if (typeof density === 'number' && Number.isFinite(density)) {
    if (density <= 4) return 4;
    if (density <= 9) return 9;
    if (density <= 12) return 12;
    if (density <= 16) return 16;
    return 20;
  }
  return DEFAULT_SETTINGS.gridDensity;
}

export function normalizeSettings(raw) {
  const cooldown = Number(raw?.cooldownMs);
  return {
    gridDensity: normalizeGridDensity(raw?.gridDensity),
    cooldownMs: Number.isFinite(cooldown)
      ? Math.min(Math.max(Math.round(cooldown), 100), 5000)
      : DEFAULT_SETTINGS.cooldownMs,
    ...normalizeVoiceSettings(raw),
  };
}

export const PET_COLORS = Object.freeze([
  {
    id: 'royal-blue',
    name: 'Royal Blue',
    bg: '#0057B8',
    fg: '#FFFFFF',
    border: '#93C5FD',
    ring: '#FFD600',
  },
  {
    id: 'bright-yellow',
    name: 'Bright Yellow',
    bg: '#FFD600',
    fg: '#0B1F3A',
    border: '#0B1F3A',
    ring: '#0057B8',
  },
  {
    id: 'dark-navy',
    name: 'Dark Navy',
    bg: '#0B1F3A',
    fg: '#FFD600',
    border: '#60A5FA',
    ring: '#FFD600',
  },
  {
    id: 'light-gray',
    name: 'Light Gray',
    bg: '#CBD5E1',
    fg: '#0B1F3A',
    border: '#334155',
    ring: '#0057B8',
  },
  {
    id: 'crisp-white',
    name: 'White',
    bg: '#FFFFFF',
    fg: '#0B1F3A',
    border: '#0057B8',
    ring: '#0057B8',
  },
]);

export const PET_ICONS = Object.freeze([
  { id: 'door', name: 'Door' },
  { id: 'bowl', name: 'Food Bowl' },
  { id: 'water', name: 'Water Drop' },
  { id: 'bone', name: 'Treat Bone' },
  { id: 'paw', name: 'Paw' },
  { id: 'ball', name: 'Ball' },
  { id: 'frisbee', name: 'Frisbee' },
  { id: 'come', name: 'Come' },
  { id: 'sit', name: 'Sit' },
  { id: 'stay', name: 'Stay' },
  { id: 'up', name: 'Up Arrow' },
  { id: 'down', name: 'Down Arrow' },
  { id: 'ok', name: 'OK Check' },
  { id: 'no', name: 'No Slash' },
  { id: 'star', name: 'Star' },
  { id: 'circle', name: 'Circle' },
  { id: 'triangle', name: 'Triangle' },
  { id: 'hexagon', name: 'Hexagon' },
]);

export function getColorPreset(colorId) {
  return PET_COLORS.find((c) => c.id === colorId) || PET_COLORS[0];
}

export function isValidIconId(iconId) {
  return PET_ICONS.some((icon) => icon.id === iconId);
}

export function createDefaultButtons(now = Date.now()) {
  return BUTTON_TYPE_PRESETS.map((preset, idx) => ({
    id: `btn-${preset.id}`,
    label: preset.label,
    ttsText: preset.ttsText,
    colorId: preset.colorId,
    iconId: preset.iconId,
    slotIndex: idx,
    hasAudio: false,
    updatedAt: now,
  }));
}

export function buildGridSlots(buttons, density) {
  const safeDensity = GRID_DENSITIES.includes(density) ? density : DEFAULT_SETTINGS.gridDensity;
  const slots = Array.from({ length: safeDensity }, () => null);
  const parked = [];
  const sorted = [...buttons].sort((a, b) => a.slotIndex - b.slotIndex || a.id.localeCompare(b.id));

  for (const btn of sorted) {
    if (Number.isInteger(btn.slotIndex) && btn.slotIndex >= 0 && btn.slotIndex < safeDensity && !slots[btn.slotIndex]) {
      slots[btn.slotIndex] = btn;
    } else {
      parked.push(btn);
    }
  }

  return { slots, parked };
}

export function swapOrMoveButtonSlot(buttons, buttonId, targetSlotIndex) {
  const moving = buttons.find((b) => b.id === buttonId);
  if (!moving || !Number.isInteger(targetSlotIndex) || targetSlotIndex < 0) {
    return buttons;
  }
  const sourceSlot = moving.slotIndex;
  if (sourceSlot === targetSlotIndex) return buttons;

  const occupant = buttons.find((b) => b.id !== buttonId && b.slotIndex === targetSlotIndex);
  const now = Date.now();

  return buttons.map((btn) => {
    if (btn.id === buttonId) {
      return { ...btn, slotIndex: targetSlotIndex, updatedAt: now };
    }
    if (occupant && btn.id === occupant.id) {
      return { ...btn, slotIndex: sourceSlot, updatedAt: now };
    }
    return btn;
  });
}

export function nextAvailableSlot(buttons, density) {
  const occupied = new Set(buttons.map((b) => b.slotIndex));
  for (let i = 0; i < density; i += 1) {
    if (!occupied.has(i)) return i;
  }
  let idx = density;
  while (occupied.has(idx)) idx += 1;
  return idx;
}
