import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGridSlots,
  createDefaultButtons,
  getColorPreset,
  nextAvailableSlot,
  PET_COLORS,
  swapOrMoveButtonSlot,
} from '../src/utils/defaults.js';

test('createDefaultButtons seeds 4 distinct starter buttons with dichromat colors', () => {
  const buttons = createDefaultButtons(1000);
  assert.equal(buttons.length, 4);
  assert.deepEqual(
    buttons.map((b) => b.label),
    ['Outside', 'Play', 'Food', 'Water']
  );
  for (const btn of buttons) {
    const preset = getColorPreset(btn.colorId);
    assert.ok(PET_COLORS.includes(preset));
  }
});

test('buildGridSlots keeps fixed empty slots and parks overflow buttons when density drops', () => {
  const custom = [
    { id: 'a', label: 'Outside', slotIndex: 0 },
    { id: 'b', label: 'Treat', slotIndex: 3 },
    { id: 'c', label: 'Walk', slotIndex: 5 },
  ];

  const grid4 = buildGridSlots(custom, 4);
  assert.equal(grid4.slots.length, 4);
  assert.equal(grid4.slots[0]?.id, 'a');
  assert.equal(grid4.slots[1], null);
  assert.equal(grid4.slots[2], null);
  assert.equal(grid4.slots[3]?.id, 'b');
  assert.deepEqual(
    grid4.parked.map((p) => p.id),
    ['c']
  );

  const grid2 = buildGridSlots(custom, 2);
  assert.equal(grid2.slots.length, 2);
  assert.deepEqual(
    grid2.parked.map((p) => p.id),
    ['b', 'c']
  );
});

test('swapOrMoveButtonSlot moves into empty slot and swaps occupied slots cleanly', () => {
  const initial = createDefaultButtons(100);
  const movedToEmpty = swapOrMoveButtonSlot(initial, 'btn-outside', 5);
  assert.equal(movedToEmpty.find((b) => b.id === 'btn-outside').slotIndex, 5);

  const swapped = swapOrMoveButtonSlot(initial, 'btn-outside', 2);
  assert.equal(swapped.find((b) => b.id === 'btn-outside').slotIndex, 2);
  assert.equal(swapped.find((b) => b.id === 'btn-food').slotIndex, 0);
});

test('nextAvailableSlot finds first open slot within density or appends afterward', () => {
  const buttons = [
    { id: 'a', slotIndex: 0 },
    { id: 'b', slotIndex: 2 },
  ];
  assert.equal(nextAvailableSlot(buttons, 4), 1);

  const full4 = createDefaultButtons();
  assert.equal(nextAvailableSlot(full4, 4), 4);
});
