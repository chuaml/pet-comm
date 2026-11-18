import { html } from 'lit-html';
import { renderIcon } from './icons.js';
import { LOCK_IDLE } from './lock.js';

const HINTS = {
  idle: '',
  holding: 'Keep holding…',
  armed: 'Slide left to the end, then let go',
};

// Rendered in its own strip above the grid so the lock never sits on top of a pet pad.
export function lockButtonView(lock, controller) {
  const { phase, pct, travelPx } = lock || LOCK_IDLE;
  const ringPct = phase === 'holding' ? pct : phase === 'armed' ? 100 : 0;
  return html`
    <div
      class="corner-lock-zone"
      data-phase=${phase}
      style=${`--lock-travel:${travelPx}px;--slide-pct:${phase === 'armed' ? pct : 0};`}
    >
      <span class="lock-hold-hint" role="status" aria-live="polite">${HINTS[phase] ?? ''}</span>
      <span class="lock-track" aria-hidden="true">
        <span class="lock-track-target"></span>
        <span class="lock-track-label">◀ Slide to unlock</span>
      </span>
      <button
        type="button"
        class="corner-lock-btn"
        data-holding=${phase === 'idle' ? 'false' : 'true'}
        data-ready=${phase === 'armed' && pct >= 90 ? 'true' : 'false'}
        aria-label="Parent Lock: press and hold, then slide left to the end and release. Keyboard: hold Enter, then press Left Arrow."
        @pointerdown=${controller.onPointerDown}
        @pointermove=${controller.onPointerMove}
        @pointerup=${controller.onPointerUp}
        @pointercancel=${controller.onPointerCancel}
        @lostpointercapture=${controller.onPointerCancel}
        @keydown=${controller.onKeyDown}
        @keyup=${controller.onKeyUp}
        @blur=${controller.onBlur}
        @contextmenu=${(e) => e.preventDefault()}
      >
        <div class="progress-ring-wrapper">
          <progress
            class="progress-ring"
            value=${ringPct}
            max="100"
            aria-label="Hold progress"
            style=${`--value: ${ringPct}`}
          ></progress>
          <span class="progress-ring-content" aria-hidden="true">
            ${renderIcon('lock', 'lock-svg')}
          </span>
        </div>
      </button>
    </div>
  `;
}
