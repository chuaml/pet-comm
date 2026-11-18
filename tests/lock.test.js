import { describe, expect, it, vi } from 'vitest';
import { createHoldUnlockController, lockTravelPx } from '../src/ui/lock.js';

const TRAVEL = 200;

function setup(options = {}) {
  vi.useFakeTimers();
  const states = [];
  const onUnlock = vi.fn();
  const controller = createHoldUnlockController({
    getTravelPx: () => TRAVEL,
    onProgress: (lock) => states.push(lock),
    onUnlock,
    ...options,
  });
  const last = () => states[states.length - 1];
  const down = (pointerId = 1, extra = {}) =>
    controller.onPointerDown({
      button: 0, pointerId, clientX: 300, clientY: 30, stopPropagation: vi.fn(), ...extra,
    });
  const move = (clientX, clientY = 30, pointerId = 1) =>
    controller.onPointerMove({ pointerId, clientX, clientY });
  const up = (pointerId = 1) => controller.onPointerUp({ pointerId });
  const key = (type, k, repeat = false) =>
    controller[type]({ key: k, repeat, preventDefault: vi.fn() });
  return { controller, states, onUnlock, last, down, move, up, key };
}

describe('hold-then-slide parent lock', () => {
  it('does not unlock from a hold alone, however long', () => {
    const { down, up, onUnlock, last } = setup();
    down();
    vi.advanceTimersByTime(300);
    expect(last().phase).toBe('holding');
    vi.advanceTimersByTime(10000);
    expect(last()).toMatchObject({ phase: 'armed', pct: 0, travelPx: TRAVEL });
    up();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(last().phase).toBe('idle');
  });

  it('cancels a tap released before the hold completes, and a hold that drifts', () => {
    const { down, move, up, onUnlock, last } = setup();
    down();
    vi.advanceTimersByTime(400);
    up();
    vi.advanceTimersByTime(1000);
    expect(last().phase).toBe('idle');

    // Sliding before the track is armed is a drift, not a head start
    down(2);
    move(260, 30, 2);
    vi.advanceTimersByTime(1000);
    move(100, 30, 2);
    up(2);
    expect(last().phase).toBe('idle');
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('unlocks only when released at the far end of the track', () => {
    const { down, move, up, onUnlock, last } = setup();
    down();
    vi.advanceTimersByTime(650);
    move(200);
    expect(last()).toMatchObject({ phase: 'armed', pct: 50 });
    move(-500);
    expect(last().pct).toBe(100);
    expect(onUnlock).not.toHaveBeenCalled();
    up();
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(last().phase).toBe('idle');
  });

  it('snaps back when released early or dragged to the end and back', () => {
    const { down, move, up, onUnlock, last } = setup();
    down();
    vi.advanceTimersByTime(650);
    move(140);
    expect(last().pct).toBe(80);
    up();
    expect(onUnlock).not.toHaveBeenCalled();

    down(2);
    vi.advanceTimersByTime(650);
    move(100, 30, 2);
    move(290, 30, 2);
    up(2);
    expect(onUnlock).not.toHaveBeenCalled();
    expect(last().phase).toBe('idle');
  });

  it('cancels when the finger leaves the track vertically or the pointer is cancelled', () => {
    const { controller, down, move, up, onUnlock, last } = setup();
    down();
    vi.advanceTimersByTime(650);
    move(100, 90);
    expect(last().phase).toBe('idle');
    move(100, 30);
    up();
    expect(onUnlock).not.toHaveBeenCalled();

    down(2);
    vi.advanceTimersByTime(650);
    move(100, 30, 2);
    controller.onPointerCancel({ pointerId: 2 });
    up(2);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('ignores other pointers so a paw elsewhere cannot cancel, restart or finish the slide', () => {
    const { controller, down, move, up, onUnlock, last } = setup();
    down(1);
    vi.advanceTimersByTime(650);
    move(150, 30, 1);

    down(7);
    move(0, 400, 7);
    up(7);
    controller.onPointerCancel({ pointerId: 7 });
    expect(last()).toMatchObject({ phase: 'armed', pct: 75 });
    expect(onUnlock).not.toHaveBeenCalled();

    move(100, 30, 1);
    up(1);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('ignores secondary mouse buttons and captures the pointer for the drag', () => {
    const { controller, down, onUnlock, states } = setup();
    controller.onPointerDown({ button: 2, pointerId: 1, clientX: 0, clientY: 0, stopPropagation: vi.fn() });
    expect(states).toHaveLength(0);

    const currentTarget = {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    };
    down(3, { currentTarget });
    expect(currentTarget.setPointerCapture).toHaveBeenCalledWith(3);
    controller.cancel();
    expect(currentTarget.releasePointerCapture).toHaveBeenCalledWith(3);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('supports the keyboard: hold Enter to arm, then Left Arrow to unlock', () => {
    const { key, onUnlock, last } = setup();
    key('onKeyDown', 'ArrowLeft');
    expect(onUnlock).not.toHaveBeenCalled();

    key('onKeyDown', 'Enter');
    vi.advanceTimersByTime(300);
    key('onKeyUp', 'Enter');
    expect(last().phase).toBe('idle');

    key('onKeyDown', ' ');
    key('onKeyDown', ' ', true);
    vi.advanceTimersByTime(650);
    key('onKeyUp', ' ');
    expect(last().phase).toBe('armed');
    key('onKeyDown', 'ArrowLeft');
    expect(onUnlock).toHaveBeenCalledTimes(1);

    // An armed keyboard lock times out instead of staying open for a wandering paw
    key('onKeyDown', 'Enter');
    vi.advanceTimersByTime(650);
    key('onKeyUp', 'Enter');
    vi.advanceTimersByTime(4100);
    expect(last().phase).toBe('idle');
    key('onKeyDown', 'ArrowLeft');
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('sizes the track from the viewport within sane bounds', () => {
    const original = window.innerWidth;
    try {
      window.innerWidth = 390;
      expect(lockTravelPx()).toBe(186);
      window.innerWidth = 1180;
      expect(lockTravelPx()).toBe(240);
      window.innerWidth = 200;
      expect(lockTravelPx()).toBe(120);
    } finally {
      window.innerWidth = original;
    }
  });
});
