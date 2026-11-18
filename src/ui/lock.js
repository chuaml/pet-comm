// Parent lock: hold, then slide. A short hold arms the track, and only a release at the far end
// unlocks, so a stray paw tap, a long lean, or a drag that comes back does nothing.

export const LOCK_IDLE = Object.freeze({ phase: 'idle', pct: 0, travelPx: 0 });
const THUMB_PX = 48;
const KEY_ARMED_TIMEOUT_MS = 4000;

export function lockTravelPx() {
  const viewport = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 390;
  return Math.max(120, Math.round(Math.min(viewport * 0.6, 288) - THUMB_PX));
}

export function createHoldUnlockController({
  holdMs = 600,
  maxDriftPx = 28,
  maxOffTrackPx = 48,
  unlockPct = 90,
  getTravelPx = lockTravelPx,
  onProgress,
  onUnlock,
}) {
  let rafId = null;
  let keyTimer = null;
  let startTime = 0;
  let phase = 'idle';
  let pct = 0;
  let travelPx = 0;
  let activePointerId = null;
  let captureTarget = null;
  let originX = 0;
  let originY = 0;
  let keyboard = false;

  const publish = (nextPhase, nextPct) => {
    if (nextPhase === phase && nextPct === pct) return;
    phase = nextPhase;
    pct = nextPct;
    onProgress(phase === 'idle' ? LOCK_IDLE : { phase, pct, travelPx });
  };

  const releaseCapture = () => {
    const target = captureTarget;
    const pointerId = activePointerId;
    captureTarget = null;
    activePointerId = null;
    try {
      if (target?.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    } catch {
      // Pointer already gone
    }
  };

  const stopTimers = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (keyTimer !== null) clearTimeout(keyTimer);
    rafId = null;
    keyTimer = null;
  };

  const cancel = () => {
    stopTimers();
    releaseCapture();
    keyboard = false;
    publish('idle', 0);
  };

  const unlock = () => {
    cancel();
    onUnlock();
  };

  const tick = (now) => {
    const elapsed = now - startTime;
    if (elapsed >= holdMs) {
      rafId = null;
      publish('armed', 0);
      return;
    }
    publish('holding', Math.max(2, Math.round((elapsed / holdMs) * 100)));
    rafId = requestAnimationFrame(tick);
  };

  const startHold = () => {
    stopTimers();
    travelPx = getTravelPx();
    startTime = performance.now();
    publish('holding', 2);
    rafId = requestAnimationFrame(tick);
  };

  const isActivePointer = (e) => activePointerId !== null && e.pointerId === activePointerId;

  return {
    onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      // A second finger or paw never restarts or hijacks a gesture already in progress
      if (phase !== 'idle') return;
      activePointerId = e.pointerId;
      originX = e.clientX;
      originY = e.clientY;
      keyboard = false;
      captureTarget = e.currentTarget ?? null;
      try {
        captureTarget?.setPointerCapture?.(e.pointerId);
      } catch {
        // Synthetic or already-released pointer: the hold still works without capture
      }
      startHold();
    },
    onPointerMove(e) {
      if (!isActivePointer(e)) return;
      const dx = originX - e.clientX;
      const dy = Math.abs(e.clientY - originY);
      if (phase === 'holding') {
        if (Math.hypot(dx, dy) > maxDriftPx) cancel();
      } else if (phase === 'armed') {
        if (dy > maxOffTrackPx) cancel();
        else publish('armed', Math.round(Math.min(Math.max(dx / travelPx, 0), 1) * 100));
      }
    },
    onPointerUp(e) {
      if (!isActivePointer(e)) return;
      if (phase === 'armed' && pct >= unlockPct) unlock();
      else cancel();
    },
    onPointerCancel(e) {
      if (isActivePointer(e)) cancel();
    },
    onKeyDown(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (phase === 'idle' && !e.repeat) {
          keyboard = true;
          startHold();
        }
      } else if (keyboard && phase === 'armed' && e.key === 'ArrowLeft') {
        e.preventDefault();
        unlock();
      } else if (keyboard && e.key === 'Escape') {
        cancel();
      }
    },
    onKeyUp(e) {
      if (!keyboard || (e.key !== 'Enter' && e.key !== ' ')) return;
      if (phase === 'holding') cancel();
      else if (phase === 'armed' && keyTimer === null) keyTimer = setTimeout(cancel, KEY_ARMED_TIMEOUT_MS);
    },
    onBlur() {
      if (keyboard) cancel();
    },
    cancel,
  };
}
