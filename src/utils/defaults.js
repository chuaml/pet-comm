export const GRID_DENSITIES = [1, 2, 4, 6, 9];
export const COOLDOWN_OPTIONS = [250, 500, 750, 1000, 1500];

export const DEFAULT_SETTINGS = Object.freeze({
  gridDensity: 4,
  cooldownMs: 500,
});

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
  { id: 'ball', name: 'Ball' },
  { id: 'bowl', name: 'Food Bowl' },
  { id: 'water', name: 'Water Drop' },
  { id: 'bone', name: 'Treat Bone' },
  { id: 'paw', name: 'Paw' },
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
  return [
    {
      id: 'btn-outside',
      label: 'Outside',
      ttsText: 'Outside',
      colorId: 'royal-blue',
      iconId: 'door',
      slotIndex: 0,
      hasAudio: false,
      updatedAt: now,
    },
    {
      id: 'btn-play',
      label: 'Play',
      ttsText: 'Play',
      colorId: 'bright-yellow',
      iconId: 'ball',
      slotIndex: 1,
      hasAudio: false,
      updatedAt: now,
    },
    {
      id: 'btn-food',
      label: 'Food',
      ttsText: 'Food',
      colorId: 'dark-navy',
      iconId: 'bowl',
      slotIndex: 2,
      hasAudio: false,
      updatedAt: now,
    },
    {
      id: 'btn-water',
      label: 'Water',
      ttsText: 'Water',
      colorId: 'crisp-white',
      iconId: 'water',
      slotIndex: 3,
      hasAudio: false,
      updatedAt: now,
    },
  ];
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
