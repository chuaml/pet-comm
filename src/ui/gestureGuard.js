// Pet Mode zoom guard. `touch-action: none` on the pet viewport is the primary defence; this
// covers iOS Safari, which also zooms through its own gesture events and multi-touch moves.
// It never touches `pointerdown`/`touchstart`, so user activation for audio is preserved, and it
// stays inactive outside Pet Mode so parents can still zoom small settings text.
// System gestures (home swipe, Control Centre, notifications) cannot be blocked from a web page.

const NON_PASSIVE = { passive: false };

export function installGestureGuard(isPetMode, target = typeof document !== 'undefined' ? document : null) {
  if (!target || typeof target.addEventListener !== 'function') return () => {};

  const block = (e) => {
    if (e.cancelable && isPetMode()) e.preventDefault();
  };
  const onTouchMove = (e) => {
    if (e.touches && e.touches.length > 1) block(e);
  };

  target.addEventListener('gesturestart', block, NON_PASSIVE);
  target.addEventListener('gesturechange', block, NON_PASSIVE);
  target.addEventListener('touchmove', onTouchMove, NON_PASSIVE);

  return () => {
    target.removeEventListener('gesturestart', block, NON_PASSIVE);
    target.removeEventListener('gesturechange', block, NON_PASSIVE);
    target.removeEventListener('touchmove', onTouchMove, NON_PASSIVE);
  };
}
