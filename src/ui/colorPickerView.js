import { html } from 'lit-html';
import {
  computeAutoForegroundHex,
  contrastRatio,
  getColorPreset,
  hexToRgb,
  normalizeCustomColor,
  PET_COLORS,
  resolveButtonColors,
  rgbToHex,
} from '../utils/colors.js';
import { renderIcon } from './icons.js';

export function createColorDraftActions(getDraft, updateDraft) {
  const updateCustomColor = (mutator) => {
    const draft = getDraft();
    if (!draft) return;
    const preset = getColorPreset(draft.colorId);
    const base = normalizeCustomColor(draft.customColor) || {
      bgHex: preset.bg,
      fgMode: 'auto',
      fgHex: computeAutoForegroundHex(hexToRgb(preset.bg)),
    };
    const next = normalizeCustomColor(mutator(base));
    if (next) updateDraft({ customColor: next });
  };

  return {
    onSelectColorPreset: (colorId) => updateDraft({ colorId, customColor: null }),
    onEnableCustomColor: () => updateCustomColor((base) => base),
    onSetCustomBgHex: (hex) => {
      const rgb = hexToRgb(hex);
      if (rgb) updateCustomColor((base) => ({ ...base, bgHex: rgbToHex(rgb) }));
    },
    onSetCustomBgRgb: (rgb) => updateCustomColor((base) => ({ ...base, bgHex: rgbToHex(rgb) })),
    onSetCustomFgMode: (fgMode) =>
      updateCustomColor((base) => ({ ...base, fgMode: fgMode === 'custom' ? 'custom' : 'auto' })),
    onSetCustomFgHex: (hex) => {
      const rgb = hexToRgb(hex);
      if (rgb) updateCustomColor((base) => ({ ...base, fgMode: 'custom', fgHex: rgbToHex(rgb) }));
    },
    onSetCustomFgRgb: (rgb) =>
      updateCustomColor((base) => ({ ...base, fgMode: 'custom', fgHex: rgbToHex(rgb) })),
  };
}

function renderRgbChannelSlider({ id, label, channelColor, value, onChange }) {
  const styleVars = `--attr-min:0;--attr-max:255;--control-value:${value};--slider-fill-color:${channelColor};--slider-thumb-color:${channelColor};`;
  return html`
    <div class="rgb-channel-row">
      <label class="rgb-channel-label" for=${id}>${label}</label>
      <input
        id=${id}
        class="voice-range rgb-range"
        type="range"
        min="0"
        max="255"
        step="1"
        value=${String(value)}
        .value=${String(value)}
        aria-valuetext=${`${value} out of 255`}
        style=${styleVars}
        @input=${(e) => {
          e.target.style.setProperty('--control-value', e.target.value);
          onChange(Number(e.target.value));
        }}
      />
      <span class="rgb-channel-val">${value}</span>
    </div>
  `;
}

function renderRgbChannelGroup({ prefix, title, hexValue, rgb, onHexInput, onChannelInput }) {
  return html`
    <div class="rgb-surface-block">
      <div class="rgb-header-row">
        <span class="rgb-surface-title">${title}</span>
        <div class="rgb-hex-controls">
          <label class="visually-hidden" for=${`${prefix}-well`}>${title} color picker</label>
          <input
            id=${`${prefix}-well`}
            type="color"
            class="native-color-well"
            .value=${hexValue}
            @input=${(e) => onHexInput(e.target.value)}
          />
          <label class="visually-hidden" for=${`${prefix}-hex`}>${title} hex code</label>
          <input
            id=${`${prefix}-hex`}
            type="text"
            class="hex-code-input"
            maxlength="7"
            autocapitalize="characters"
            autocorrect="off"
            spellcheck="false"
            .value=${hexValue}
            @change=${(e) => onHexInput(e.target.value)}
          />
        </div>
      </div>

      ${renderRgbChannelSlider({
        id: `${prefix}-r`,
        label: 'R',
        channelColor: '#f87171',
        value: rgb.r,
        onChange: (r) => onChannelInput({ ...rgb, r }),
      })}
      ${renderRgbChannelSlider({
        id: `${prefix}-g`,
        label: 'G',
        channelColor: '#4ade80',
        value: rgb.g,
        onChange: (g) => onChannelInput({ ...rgb, g }),
      })}
      ${renderRgbChannelSlider({
        id: `${prefix}-b`,
        label: 'B',
        channelColor: '#60a5fa',
        value: rgb.b,
        onChange: (b) => onChannelInput({ ...rgb, b }),
      })}
    </div>
  `;
}

export function colorPickerView(draft, actions) {
  const resolved = resolveButtonColors(draft);
  const custom = draft.customColor;
  const isCustom = Boolean(custom);
  const bgRgb = hexToRgb(resolved.bg) || { r: 0, g: 87, b: 184 };
  const fgRgb = hexToRgb(resolved.fg) || { r: 255, g: 255, b: 255 };
  const autoFg = computeAutoForegroundHex(bgRgb);
  const ratio = contrastRatio(bgRgb, fgRgb);
  const fgMode = custom?.fgMode === 'custom' ? 'custom' : 'auto';

  return html`
    <fieldset class="choice-fieldset">
      <legend>Button Color (18 Swatches or Custom Full RGB)</legend>

      <div class="color-swatch-grid">
        ${PET_COLORS.map(
          (color) => html`
            <button
              type="button"
              class="color-swatch-chip"
              aria-pressed=${!isCustom && draft.colorId === color.id ? 'true' : 'false'}
              style=${`--sw-bg:${color.bg};--sw-fg:${color.fg};--sw-border:${color.border};`}
              @click=${() => actions.onSelectColorPreset(color.id)}
            >
              <span class="swatch-dot" aria-hidden="true"></span>
              <span>${color.name}</span>
            </button>
          `
        )}
        <button
          type="button"
          class="color-swatch-chip custom-rgb-trigger"
          aria-pressed=${isCustom ? 'true' : 'false'}
          @click=${actions.onEnableCustomColor}
        >
          <span class="swatch-dot swatch-dot-rainbow" aria-hidden="true"></span>
          <span>Custom RGB…</span>
        </button>
      </div>

      ${isCustom
        ? html`
            <div class="custom-rgb-panel" role="region" aria-label="Custom RGB color controls">
              <div class="rgb-preview-bar">
                <div
                  class="rgb-live-preview"
                  data-fg-mode=${fgMode}
                  style=${`--pad-bg:${resolved.bg};--pad-fg:${resolved.fg};--pad-border:${resolved.border};`}
                >
                  ${renderIcon(draft.iconId, 'rgb-preview-svg')}
                  <span>${draft.label.trim() || 'Preview'}</span>
                </div>
                <div class="rgb-contrast-meta">
                  <strong>Contrast: ${ratio.toFixed(1)}:1</strong>
                  <span class="field-hint">
                    ${ratio >= 4.5
                      ? 'High readability (WCAG AA+)'
                      : 'Low contrast — consider Auto High-Contrast text'}
                  </span>
                </div>
              </div>

              ${renderRgbChannelGroup({
                prefix: 'bg-rgb',
                title: 'Background RGB',
                hexValue: resolved.bg,
                rgb: bgRgb,
                onHexInput: actions.onSetCustomBgHex,
                onChannelInput: actions.onSetCustomBgRgb,
              })}

              <div class="rgb-fg-mode-row" role="group" aria-label="Text and icon color mode">
                <button
                  type="button"
                  class="rgb-mode-pill"
                  aria-pressed=${fgMode === 'auto' ? 'true' : 'false'}
                  @click=${() => actions.onSetCustomFgMode('auto')}
                >
                  Auto High-Contrast (${autoFg})
                </button>
                <button
                  type="button"
                  class="rgb-mode-pill"
                  aria-pressed=${fgMode === 'custom' ? 'true' : 'false'}
                  @click=${() => actions.onSetCustomFgMode('custom')}
                >
                  Custom Text RGB
                </button>
              </div>

              ${fgMode === 'custom'
                ? renderRgbChannelGroup({
                    prefix: 'fg-rgb',
                    title: 'Text & Icon RGB',
                    hexValue: resolved.fg,
                    rgb: fgRgb,
                    onHexInput: actions.onSetCustomFgHex,
                    onChannelInput: actions.onSetCustomFgRgb,
                  })
                : null}
            </div>
          `
        : null}
    </fieldset>
  `;
}
