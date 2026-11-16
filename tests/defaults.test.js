import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGridSlots,
  createDefaultButtons,
  DEFAULT_SETTINGS,
  getColorPreset,
  GRID_DENSITIES,
  isValidIconId,
  nextAvailableSlot,
  normalizeGridDensity,
  PET_COLORS,
  swapOrMoveButtonSlot,
} from '../src/utils/defaults.js';
import { BUTTON_TYPE_PRESETS } from '../src/utils/presets.js';

test('GRID_DENSITIES starts at 16 by default and supports [4, 9, 12, 16, 20]', () => {
  assert.deepEqual(GRID_DENSITIES, [4, 9, 12, 16, 20]);
  assert.equal(DEFAULT_SETTINGS.gridDensity, 16);
  assert.equal(normalizeGridDensity(1), 4);
  assert.equal(normalizeGridDensity(2), 4);
  assert.equal(normalizeGridDensity(6), 9);
  assert.equal(normalizeGridDensity(16), 16);
  assert.equal(normalizeGridDensity(20), 20);
});

test('createDefaultButtons seeds 14 starter presets in slots 0..13 leaving slots 14..15 open on 16-slot grid', () => {
  const buttons = createDefaultButtons(1000);
  assert.equal(buttons.length, 14);
  assert.equal(BUTTON_TYPE_PRESETS.length, 14);

  const labels = buttons.map((b) => b.label.toLowerCase());
  for (const required of ['sit', 'stay', 'play', 'eat', 'water', 'no', 'ok', 'frisbee', 'ball', 'up', 'down', 'come']) {
    assert.ok(labels.includes(required), `Missing preset: ${required}`);
  }

  const okBtn = buttons.find((b) => b.label === 'OK');
  assert.equal(okBtn?.ttsText, 'Okay');

  for (const btn of buttons) {
    assert.ok(PET_COLORS.includes(getColorPreset(btn.colorId)));
    assert.ok(isValidIconId(btn.iconId), `Invalid iconId: ${btn.iconId}`);
  }

  const grid16 = buildGridSlots(buttons, 16);
  assert.equal(grid16.slots.length, 16);
  assert.equal(grid16.slots[0]?.label, 'Outside');
  assert.equal(grid16.slots[13]?.label, 'No');
  assert.equal(grid16.slots[14], null);
  assert.equal(grid16.slots[15], null);
  assert.equal(grid16.parked.length, 0);
});

test('buildGridSlots keeps fixed empty slots and parks overflow buttons when density drops', () => {
  const custom = [
    { id: 'a', label: 'Outside', slotIndex: 0 },
    { id: 'b', label: 'Treat', slotIndex: 3 },
    { id: 'c', label: 'Frisbee', slotIndex: 10 },
  ];

  const grid12 = buildGridSlots(custom, 12);
  assert.equal(grid12.slots.length, 12);
  assert.equal(grid12.slots[0]?.id, 'a');
  assert.equal(grid12.slots[1], null);
  assert.equal(grid12.slots[3]?.id, 'b');
  assert.equal(grid12.slots[10]?.id, 'c');
  assert.equal(grid12.parked.length, 0);

  const grid4 = buildGridSlots(custom, 4);
  assert.equal(grid4.slots.length, 4);
  assert.deepEqual(
    grid4.parked.map((p) => p.id),
    ['c']
  );
});

test('swapOrMoveButtonSlot moves into empty slot and swaps occupied slots cleanly', () => {
  const initial = createDefaultButtons(100);
  const movedToEmpty = swapOrMoveButtonSlot(initial, 'btn-outside', 15);
  assert.equal(movedToEmpty.find((b) => b.id === 'btn-outside').slotIndex, 15);

  const swapped = swapOrMoveButtonSlot(initial, 'btn-outside', 2);
  assert.equal(swapped.find((b) => b.id === 'btn-outside').slotIndex, 2);
  assert.equal(swapped.find((b) => b.id === 'btn-water').slotIndex, 0);
});

test('nextAvailableSlot finds first open slot within density or appends afterward', () => {
  const buttons = createDefaultButtons();
  assert.equal(nextAvailableSlot(buttons, 16), 14);
  assert.equal(nextAvailableSlot(buttons, 12), 14);
});
