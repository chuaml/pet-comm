import { describe, expect, it } from 'vitest';
import {
  buildGridSlots,
  createDefaultButtons,
  DEFAULT_SETTINGS,
  getColorPreset,
  GRID_DENSITIES,
  isValidIconId,
  nextAvailableSlot,
  normalizeGridDensity,
  normalizePadGap,
  normalizeSettings,
  PAD_GAP_OPTIONS,
  PET_COLORS,
  swapOrMoveButtonSlot,
} from '../src/utils/defaults.js';
import { BUTTON_TYPE_PRESETS } from '../src/utils/presets.js';

describe('defaults & spatial grid helpers', () => {
  it('starts at 16 by default and supports [4, 9, 12, 16, 20]', () => {
    expect(GRID_DENSITIES).toEqual([4, 9, 12, 16, 20]);
    expect(DEFAULT_SETTINGS.gridDensity).toBe(16);
    expect(normalizeGridDensity(1)).toBe(4);
    expect(normalizeGridDensity(2)).toBe(4);
    expect(normalizeGridDensity(6)).toBe(9);
    expect(normalizeGridDensity(16)).toBe(16);
    expect(normalizeGridDensity(20)).toBe(20);
  });

  it('defaults the pad gap to comfortable and falls back for unknown or missing values', () => {
    expect(PAD_GAP_OPTIONS.map((o) => o.id)).toEqual(['compact', 'comfortable', 'wide', 'extra-wide']);
    expect(DEFAULT_SETTINGS.padGap).toBe('comfortable');
    for (const id of ['compact', 'comfortable', 'wide', 'extra-wide']) expect(normalizePadGap(id)).toBe(id);
    for (const bad of [undefined, null, '', 'huge', 3, {}]) expect(normalizePadGap(bad)).toBe('comfortable');
    // Settings saved before the gap option existed pick up the new default
    expect(normalizeSettings({ gridDensity: 16, cooldownMs: 500 }).padGap).toBe('comfortable');
    expect(normalizeSettings({ padGap: 'compact' }).padGap).toBe('compact');
  });

  it('seeds 14 starter presets in slots 0..13 leaving slots 14..15 open on 16-slot grid', () => {
    const buttons = createDefaultButtons(1000);
    expect(buttons).toHaveLength(14);
    expect(BUTTON_TYPE_PRESETS).toHaveLength(14);

    const labels = buttons.map((b) => b.label.toLowerCase());
    for (const required of [
      'sit',
      'stay',
      'play',
      'eat',
      'water',
      'no',
      'ok',
      'frisbee',
      'ball',
      'up',
      'down',
      'come',
    ]) {
      expect(labels).toContain(required);
    }

    expect(buttons.find((b) => b.label === 'OK')?.ttsText).toBe('Okay');

    for (const btn of buttons) {
      expect(PET_COLORS).toContain(getColorPreset(btn.colorId));
      expect(isValidIconId(btn.iconId)).toBe(true);
    }

    const grid16 = buildGridSlots(buttons, 16);
    expect(grid16.slots).toHaveLength(16);
    expect(grid16.slots[0]?.label).toBe('Outside');
    expect(grid16.slots[13]?.label).toBe('No');
    expect(grid16.slots[14]).toBeNull();
    expect(grid16.slots[15]).toBeNull();
    expect(grid16.parked).toHaveLength(0);
  });

  it('keeps fixed empty slots and parks overflow buttons when density drops', () => {
    const custom = [
      { id: 'a', label: 'Outside', slotIndex: 0 },
      { id: 'b', label: 'Treat', slotIndex: 3 },
      { id: 'c', label: 'Frisbee', slotIndex: 10 },
    ];

    const grid12 = buildGridSlots(custom, 12);
    expect(grid12.slots).toHaveLength(12);
    expect(grid12.slots[0]?.id).toBe('a');
    expect(grid12.slots[1]).toBeNull();
    expect(grid12.slots[3]?.id).toBe('b');
    expect(grid12.slots[10]?.id).toBe('c');
    expect(grid12.parked).toHaveLength(0);

    const grid4 = buildGridSlots(custom, 4);
    expect(grid4.slots).toHaveLength(4);
    expect(grid4.parked.map((p) => p.id)).toEqual(['c']);
  });

  it('moves into empty slot and swaps occupied slots cleanly', () => {
    const initial = createDefaultButtons(100);
    const movedToEmpty = swapOrMoveButtonSlot(initial, 'btn-outside', 15);
    expect(movedToEmpty.find((b) => b.id === 'btn-outside')?.slotIndex).toBe(15);

    const swapped = swapOrMoveButtonSlot(initial, 'btn-outside', 2);
    expect(swapped.find((b) => b.id === 'btn-outside')?.slotIndex).toBe(2);
    expect(swapped.find((b) => b.id === 'btn-water')?.slotIndex).toBe(0);
  });

  it('finds first open slot within density or appends afterward', () => {
    const buttons = createDefaultButtons();
    expect(nextAvailableSlot(buttons, 16)).toBe(14);
    expect(nextAvailableSlot(buttons, 12)).toBe(14);
  });
});
