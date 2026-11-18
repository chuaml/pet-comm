import { html } from 'lit-html';
import { resolveButtonColors } from '../utils/defaults.js';
import { renderIcon } from './icons.js';

export function renderPetPad(btn, isFlashing, isAttention, actions) {
  const color = resolveButtonColors(btn);
  const fgMode = btn.customColor && btn.customColor.fgMode !== 'custom' ? 'auto' : 'preset';
  const styleVars = `--pad-bg:${color.bg};--pad-fg:${color.fg};--pad-border:${color.border};--pad-ring:${color.ring};`;

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    actions.onPetPress(btn);
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
      @keydown=${onKeyDown}
      @contextmenu=${(e) => e.preventDefault()}
    >
      <span class="pad-icon-wrap">${renderIcon(btn.iconId, 'pad-icon')}</span>
      <span class="pad-label">${btn.label}</span>
    </button>
  `;
}
