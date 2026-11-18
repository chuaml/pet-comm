import { describe, expect, it } from 'vitest';
import { installGestureGuard } from '../src/ui/gestureGuard.js';

function fire(target, type, touchCount) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (touchCount !== undefined) event.touches = Array.from({ length: touchCount }, () => ({}));
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('Pet Mode gesture guard', () => {
  it('blocks pinch gestures and multi-touch moves in Pet Mode only', () => {
    let mode = 'pet';
    const root = document.getElementById('test-root');
    const uninstall = installGestureGuard(() => mode === 'pet', root);

    expect(fire(root, 'gesturestart')).toBe(true);
    expect(fire(root, 'gesturechange')).toBe(true);
    expect(fire(root, 'touchmove', 2)).toBe(true);
    // One finger is never blocked: single touches drive the pads and the lock slide
    expect(fire(root, 'touchmove', 1)).toBe(false);
    // Activation-granting events are never touched
    expect(fire(root, 'touchstart', 2)).toBe(false);
    expect(fire(root, 'pointerdown')).toBe(false);

    mode = 'parent';
    expect(fire(root, 'gesturestart')).toBe(false);
    expect(fire(root, 'touchmove', 2)).toBe(false);

    mode = 'pet';
    uninstall();
    expect(fire(root, 'gesturestart')).toBe(false);
    expect(fire(root, 'touchmove', 2)).toBe(false);
  });

  it('is a no-op without a DOM target', () => {
    expect(() => installGestureGuard(() => true, null)()).not.toThrow();
  });
});
