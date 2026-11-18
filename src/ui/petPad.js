import { html } from 'lit-html';
import { resolveButtonColors } from '../utils/defaults.js';
import { renderIcon } from './icons.js';

// Touch grants user activation on release, not on pointerdown, so the very first touch after a
// page load can have its audio refused. That one press is replayed once on pointerup.
let unactivatedPress = null;

function pageNeverActivated() {
  const activation = typeof navigator !== 'undefined' ? navigator.userActivation : null;
  return Boolean(activation) && activation.hasBeenActive === false;
}

export function renderPetPad(btn, isFlashing, isAttention, actions) {
  const color = resolveButtonColors(btn);
  const fgMode = btn.customColor && btn.customColor.fgMode !== 'custom' ? 'auto' : 'preset';
  const styleVars = `--pad-bg:${color.bg};--pad-fg:${color.fg};--pad-border:${color.border};--pad-ring:${color.ring};`;

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    unactivatedPress = pageNeverActivated() ? { buttonId: btn.id, pointerId: e.pointerId } : null;
    actions.onPetPress(btn);
  };

  const onPointerUp = (e) => {
    const pending = unactivatedPress;
    unactivatedPress = null;
    if (!pending || pending.buttonId !== btn.id || pending.pointerId !== e.pointerId) return;
    if (!pageNeverActivated()) actions.onPreviewButton(btn);
  };

  const onKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      actions.onPetPress(btn);
    }
  };

  return html`
    <button
      type="button"
      class="pet-pad"
      data-pressed=${isFlashing ? 'true' : 'false'}
      data-attention=${isAttention ? 'true' : 'false'}
      data-fg-mode=${fgMode}
      style=${styleVars}
      aria-label=${btn.label}
      @pointerdown=${onPointerDown}
      @pointerup=${onPointerUp}
      @pointercancel=${() => (unactivatedPress = null)}
      @keydown=${onKeyDown}
      @contextmenu=${(e) => e.preventDefault()}
    >
      <span class="pad-icon-wrap">${renderIcon(btn.iconId, 'pad-icon')}</span>
      <span class="pad-label">${btn.label}</span>
    </button>
  `;
}
