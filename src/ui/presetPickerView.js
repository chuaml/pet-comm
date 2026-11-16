import { html } from 'lit-html';
import { getColorPreset } from '../utils/defaults.js';
import { BUTTON_TYPE_PRESETS, matchButtonPresetId } from '../utils/presets.js';
import { renderIcon } from './icons.js';

export function presetPickerView(draft, actions) {
  const activePresetId = matchButtonPresetId(draft);

  return html`
    <fieldset class="choice-fieldset">
      <legend>Quick Button Type (Tap to Auto-Fill)</legend>
      <div class="preset-type-grid">
        ${BUTTON_TYPE_PRESETS.map((preset) => {
          const color = getColorPreset(preset.colorId);
          const chipVars = `--chip-bg:${color.bg};--chip-fg:${color.fg};--chip-border:${color.border};`;
          return html`
            <button
              type="button"
              class="preset-type-chip"
              aria-pressed=${activePresetId === preset.id ? 'true' : 'false'}
              style=${chipVars}
              @click=${() => actions.onApplyPreset(preset.id)}
            >
              <span class="preset-chip-icon" aria-hidden="true">
                ${renderIcon(preset.iconId, 'preset-chip-svg')}
              </span>
              <span>${preset.label}</span>
            </button>
          `;
        })}
      </div>
    </fieldset>
  `;
}
