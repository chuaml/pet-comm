import { html } from 'lit-html';
import { resolveBestVoice } from '../audio/ttsVoice.js';
import { matchVoicePresetId, VOICE_PRESETS, VOICE_SAMPLE_WORDS } from '../utils/presets.js';
import { renderIcon } from './icons.js';

function renderSliderField({ id, name, label, min, max, step, value, readout, valueText, hint, onInput }) {
  const styleVars = `--attr-min:${min};--attr-max:${max};--control-value:${value};`;
  return html`
    <div class="slider-field">
      <div class="slider-label-row">
        <label for=${id}>${label}</label>
        <span class="slider-readout">${readout}</span>
      </div>
      <input
        id=${id}
        name=${name}
        class="voice-range"
        type="range"
        min=${min}
        max=${max}
        step=${step}
        value=${String(value)}
        .value=${String(value)}
        aria-valuetext=${valueText}
        aria-describedby=${`${id}-hint`}
        style=${styleVars}
        @input=${(e) => {
          e.target.style.setProperty('--control-value', e.target.value);
          onInput(Number(e.target.value));
        }}
      />
      <span id=${`${id}-hint`} class="field-hint">${hint}</span>
    </div>
  `;
}

export function voiceDialogView(state, actions) {
  const settings = state.settings;
  const voices = state.availableVoices || [];
  const activePresetId = matchVoicePresetId(settings);
  const autoBest = resolveBestVoice(voices, 'auto');
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return html`
    <dialog
      id="voice-dialog"
      class="app-dialog"
      closedby="any"
      aria-labelledby="voice-dialog-title"
      @close=${actions.onVoiceNativeClose}
    >
      <div class="dialog-header">
        <h2 id="voice-dialog-title" class="dialog-title">Voice Tune &amp; Speech Settings</h2>
        <button
          type="button"
          class="dialog-close-btn"
          aria-label="Close voice settings"
          @click=${actions.onCloseVoiceModal}
        >
          ✕
        </button>
      </div>

      <div class="activity-dialog-body">
        ${!ttsSupported
          ? html`<p class="error-banner" role="status">
              Text-to-Speech is unavailable in this browser. Custom recorded button clips will still play normally.
            </p>`
          : null}

        <fieldset class="choice-fieldset">
          <legend>Quick Tone Presets</legend>
          <div class="voice-preset-grid">
            ${VOICE_PRESETS.map(
              (preset, idx) => html`
                <button
                  type="button"
                  class="voice-preset-btn"
                  aria-pressed=${activePresetId === preset.id ? 'true' : 'false'}
                  ?autofocus=${idx === 0}
                  @click=${() => actions.onSelectVoicePreset(preset.id)}
                >
                  <strong>${preset.name}</strong>
                  <small>${preset.description}</small>
                </button>
              `
            )}
          </div>
        </fieldset>

        <div class="field-group">
          <label for="voice-uri-select">System Voice</label>
          <select
            id="voice-uri-select"
            name="voiceURI"
            class="toolbar-select"
            aria-describedby="voice-uri-hint"
            .value=${settings.voiceURI || 'auto'}
            @change=${(e) => actions.onUpdateVoiceSettings({ voiceURI: e.target.value })}
          >
            <option value="auto" ?selected=${settings.voiceURI === 'auto'}>
              Auto — Best Human Voice${autoBest ? ` (${autoBest.name})` : ''}
            </option>
            ${voices.map(
              (v) => html`
                <option value=${v.voiceURI} ?selected=${settings.voiceURI === v.voiceURI}>
                  ${v.name} (${v.lang}${v.localService ? ' · Offline' : ''})
                </option>
              `
            )}
          </select>
          <span id="voice-uri-hint" class="field-hint">
            Applies to all buttons using Text-to-Speech. Custom recorded microphone clips play unmodified.
          </span>
        </div>

        <section class="panel-card voice-sliders-card" aria-labelledby="voice-fine-tune-heading">
          <h3 id="voice-fine-tune-heading" class="section-heading">Fine-Tune Voice Sound</h3>

          ${renderSliderField({
            id: 'voice-pitch-range',
            name: 'ttsPitch',
            label: 'Pitch (Higher & Friendlier)',
            min: 0.6,
            max: 1.8,
            step: 0.05,
            value: settings.ttsPitch,
            readout: `${settings.ttsPitch.toFixed(2)}×`,
            valueText: `${settings.ttsPitch.toFixed(2)} times normal pitch`,
            hint: '1.20× gives a warmer, pet-friendly upward inflection.',
            onInput: (ttsPitch) => actions.onUpdateVoiceSettings({ ttsPitch }),
          })}

          ${renderSliderField({
            id: 'voice-rate-range',
            name: 'ttsRate',
            label: 'Speed (Clarity & Pace)',
            min: 0.6,
            max: 1.4,
            step: 0.05,
            value: settings.ttsRate,
            readout: `${settings.ttsRate.toFixed(2)}×`,
            valueText: `${settings.ttsRate.toFixed(2)} times normal speed`,
            hint: 'Slightly slower (0.90×–0.95×) keeps short cue words clear.',
            onInput: (ttsRate) => actions.onUpdateVoiceSettings({ ttsRate }),
          })}

          ${renderSliderField({
            id: 'voice-volume-range',
            name: 'ttsVolume',
            label: 'Softness / Volume',
            min: 0.2,
            max: 1.0,
            step: 0.05,
            value: settings.ttsVolume,
            readout: `${Math.round(settings.ttsVolume * 100)}%`,
            valueText: `${Math.round(settings.ttsVolume * 100)} percent volume`,
            hint: '80% softens sharp consonants for sensitive dog and cat ears.',
            onInput: (ttsVolume) => actions.onUpdateVoiceSettings({ ttsVolume }),
          })}
        </section>

        <section class="panel-card" aria-labelledby="voice-preview-heading">
          <h3 id="voice-preview-heading" class="section-heading">Test Voice Now</h3>
          <div class="voice-sample-row">
            ${VOICE_SAMPLE_WORDS.map(
              (word) => html`
                <button
                  type="button"
                  class="slot-btn"
                  @click=${() => actions.onPreviewVoiceSample(word)}
                >
                  ${renderIcon('play', 'btn-inline-svg')} "${word}"
                </button>
              `
            )}
          </div>
        </section>

        <div class="dialog-footer voice-dialog-footer">
          <button type="button" class="slot-btn" @click=${actions.onResetVoiceDefaults}>
            Reset Default
          </button>
          <button type="button" class="btn-primary" @click=${actions.onCloseVoiceModal}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  `;
}
