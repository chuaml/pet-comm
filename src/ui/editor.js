import { html } from 'lit-html';
import { isRecordingSupported } from '../audio/recorder.js';
import { PET_COLORS, PET_ICONS } from '../utils/defaults.js';
import { renderIcon } from './icons.js';
import { presetPickerView } from './presetPickerView.js';

export function editorDialogView(state, actions) {
  const draft = state.editorDraft;

  return html`
    <dialog
      id="editor-dialog"
      class="app-dialog"
      aria-labelledby="editor-dialog-title"
      @close=${actions.onEditorNativeClose}
    >
      ${draft
        ? html`
            <div class="dialog-header">
              <h2 id="editor-dialog-title" class="dialog-title">
                ${draft.isNew ? `Add Button (Slot ${draft.slotIndex + 1})` : `Edit "${draft.initialLabel}"`}
              </h2>
              <button
                type="button"
                class="dialog-close-btn"
                aria-label="Close button editor"
                @click=${actions.onCloseEditor}
              >
                ✕
              </button>
            </div>

            <form class="editor-form" @submit=${actions.onSaveEditor}>
              ${presetPickerView(draft, actions)}

              <div class="form-row-split">
                <div class="field-group">
                  <label for="btn-label-input">
                    Button Word / Label <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="btn-label-input"
                    name="label"
                    type="text"
                    required
                    maxlength="28"
                    enterkeyhint="next"
                    .value=${draft.label}
                    @input=${(e) => actions.onUpdateDraft({ label: e.target.value })}
                    autofocus
                  />
                </div>

                <div class="field-group">
                  <label for="btn-tts-input">TTS Fallback Phrase</label>
                  <input
                    id="btn-tts-input"
                    name="ttsText"
                    type="text"
                    maxlength="80"
                    enterkeyhint="done"
                    aria-describedby="btn-tts-hint"
                    .value=${draft.ttsText}
                    @input=${(e) => actions.onUpdateDraft({ ttsText: e.target.value })}
                  />
                  <span id="btn-tts-hint" class="field-hint">
                    Spoken automatically if no custom voice clip is recorded.
                  </span>
                </div>
              </div>

              <fieldset class="choice-fieldset">
                <legend>Pet-Vision Color (Canine/Feline High Contrast)</legend>
                <div class="color-swatch-grid">
                  ${PET_COLORS.map(
                    (color) => html`
                      <div class="radio-tile-wrap">
                        <input
                          class="visually-hidden"
                          type="radio"
                          id=${`color-${color.id}`}
                          name="colorId"
                          value=${color.id}
                          .checked=${draft.colorId === color.id}
                          @change=${() => actions.onUpdateDraft({ colorId: color.id })}
                        />
                        <label
                          class="color-swatch-label"
                          for=${`color-${color.id}`}
                          style=${`--sw-bg:${color.bg};--sw-fg:${color.fg};--sw-border:${color.border};`}
                        >
                          <span class="swatch-dot" aria-hidden="true"></span>
                          <span>${color.name}</span>
                        </label>
                      </div>
                    `
                  )}
                </div>
              </fieldset>

              <fieldset class="choice-fieldset">
                <legend>Geometric Shape / Icon</legend>
                <div class="icon-choice-grid">
                  ${PET_ICONS.map(
                    (icon) => html`
                      <div class="radio-tile-wrap">
                        <input
                          class="visually-hidden"
                          type="radio"
                          id=${`icon-${icon.id}`}
                          name="iconId"
                          value=${icon.id}
                          .checked=${draft.iconId === icon.id}
                          @change=${() => actions.onUpdateDraft({ iconId: icon.id })}
                        />
                        <label class="icon-choice-label" for=${`icon-${icon.id}`}>
                          ${renderIcon(icon.id, 'picker-svg')}
                          <span>${icon.name}</span>
                        </label>
                      </div>
                    `
                  )}
                </div>
              </fieldset>

              <section class="recorder-box" aria-labelledby="voice-rec-title">
                <div class="recorder-top">
                  <div>
                    <h3 id="voice-rec-title" class="recorder-heading">Custom Voice Recording</h3>
                    <p class="recorder-sub">
                      ${draft.hasAudio
                        ? `Saved custom voice (${Math.max(0.1, (draft.audioDurationMs || 800) / 1000).toFixed(1)}s WAV, silence trimmed)`
                        : 'Using Text-to-Speech fallback'}
                    </p>
                  </div>

                  <div class="recorder-preview-btns">
                    <button type="button" class="slot-btn" @click=${actions.onPreviewDraftAudio}>
                      ${renderIcon('play', 'btn-inline-svg')} Test Sound
                    </button>
                    ${draft.hasAudio
                      ? html`<button type="button" class="slot-btn" @click=${actions.onClearDraftAudio}>
                          Use TTS Instead
                        </button>`
                      : null}
                  </div>
                </div>

                ${isRecordingSupported()
                  ? html`
                      <div class="recorder-controls">
                        <button
                          type="button"
                          class="record-trigger-btn"
                          data-recording=${draft.isRecording ? 'true' : 'false'}
                          @pointerdown=${actions.onRecordPointerDown}
                          @pointerup=${actions.onRecordPointerUp}
                          @pointercancel=${actions.onRecordPointerUp}
                          @keydown=${actions.onRecordKeyDown}
                        >
                          ${renderIcon(draft.isRecording ? 'stop' : 'mic', 'btn-inline-svg')}
                          ${draft.isRecording
                            ? `Recording… ${(draft.recordingElapsedMs / 1000).toFixed(1)}s / 5.0s (Tap to Stop)`
                            : 'Hold or Tap to Record Voice (max 5s)'}
                        </button>
                        ${draft.isRecording
                          ? html`<progress
                              class="record-linear-progress"
                              value=${draft.recordingElapsedMs}
                              max="5000"
                              aria-label="Recording duration"
                            ></progress>`
                          : null}
                      </div>
                    `
                  : html`<p class="field-hint">
                      Microphone capture is unavailable on this device; Text-to-Speech will be used.
                    </p>`}

                ${draft.recordError ? html`<p class="error-banner" role="alert">${draft.recordError}</p>` : null}
              </section>

              <div class="dialog-footer">
                <div class="delete-zone">
                  ${!draft.isNew
                    ? draft.confirmDelete
                      ? html`
                          <button type="button" class="btn-danger" @click=${actions.onConfirmDeleteButton}>
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            class="slot-btn"
                            @click=${() => actions.onUpdateDraft({ confirmDelete: false })}
                          >
                            Keep
                          </button>
                        `
                      : html`
                          <button
                            type="button"
                            class="btn-danger-outline"
                            @click=${() => actions.onUpdateDraft({ confirmDelete: true })}
                          >
                            ${renderIcon('trash', 'btn-inline-svg')} Delete
                          </button>
                        `
                    : null}
                </div>

                <div class="save-zone">
                  <button type="button" class="slot-btn" @click=${actions.onCloseEditor}>Cancel</button>
                  <button type="submit" class="btn-primary">Save Button</button>
                </div>
              </div>
            </form>
          `
        : null}
    </dialog>
  `;
}
