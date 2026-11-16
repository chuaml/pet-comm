import { html } from 'lit-html';
import { renderIcon } from './icons.js';

export function createHoldUnlockController({
  holdMs = 3000,
  maxDriftPx = 28,
  onProgress,
  onUnlock,
}) {
  let rafId = null;
  let startTime = 0;
  let activePointerId = null;
  let originX = 0;
  let originY = 0;
  let keyboardHolding = false;

  const cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    activePointerId = null;
    keyboardHolding = false;
    onProgress(0);
  };

  const tick = (now) => {
    const elapsed = now - startTime;
    const pct = Math.min(100, Math.round((elapsed / holdMs) * 100));
    onProgress(pct);
    if (elapsed >= holdMs) {
      rafId = null;
      activePointerId = null;
      keyboardHolding = false;
      onProgress(0);
      onUnlock();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  const startHold = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    startTime = performance.now();
    onProgress(2);
    rafId = requestAnimationFrame(tick);
  };

  return {
    onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      activePointerId = e.pointerId;
      originX = e.clientX;
      originY = e.clientY;
      startHold();
    },
    onPointerMove(e) {
      if (activePointerId === null || e.pointerId !== activePointerId) return;
      if (Math.hypot(e.clientX - originX, e.clientY - originY) > maxDriftPx) {
        cancel();
      }
    },
    onPointerEnd(e) {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        cancel();
      }
    },
    onKeyDown(e) {
      if ((e.key === 'Enter' || e.key === ' ') && !keyboardHolding) {
        e.preventDefault();
        keyboardHolding = true;
        startHold();
      }
    },
    onKeyUp(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        cancel();
      }
    },
    cancel,
  };
}

export function lockButtonView(progressPct, controller) {
  const active = progressPct > 0;
  return html`
    <div class="corner-lock-zone">
      ${active
        ? html`<span class="lock-hold-hint" aria-live="polite">Hold 3s for Parent Mode…</span>`
        : null}
      <button
        type="button"
        class="corner-lock-btn"
        data-holding=${active ? 'true' : 'false'}
        aria-label="Parent Lock: press and hold for 3 seconds to configure buttons"
        @pointerdown=${controller.onPointerDown}
        @pointermove=${controller.onPointerMove}
        @pointerup=${controller.onPointerEnd}
        @pointercancel=${controller.onPointerEnd}
        @pointerleave=${controller.onPointerEnd}
        @keydown=${controller.onKeyDown}
        @keyup=${controller.onKeyUp}
        @contextmenu=${(e) => e.preventDefault()}
      >
        <div class="progress-ring-wrapper">
          <progress
            class="progress-ring"
            value=${progressPct}
            max="100"
            aria-label="Unlock progress"
            style=${`--value: ${progressPct}`}
          ></progress>
          <span class="progress-ring-content" aria-hidden="true">
            ${renderIcon('lock', 'lock-svg')}
          </span>
        </div>
      </button>
    </div>
  `;
}
