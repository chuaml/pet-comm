import { html } from 'lit-html';
import {
  buildGridSlots,
  COOLDOWN_OPTIONS,
  GRID_DENSITIES,
  resolveButtonColors,
} from '../utils/defaults.js';
import { attentionCueControlView } from './attentionCue.js';
import { renderIcon } from './icons.js';
import { parentLoadingStatusView } from './loadingStatusView.js';
import { lockButtonView } from './lock.js';
import { renderPetPad } from './petPad.js';

function renderParentSlot(btn, slotIdx, movingButtonId, actions) {
  const isMoveMode = Boolean(movingButtonId);
  const isSelectedSource = movingButtonId === btn?.id;

  if (!btn) {
    return html`
      <button
        type="button"
        class="parent-slot parent-slot-empty"
        data-move-target=${isMoveMode ? 'true' : 'false'}
        @click=${() => (isMoveMode ? actions.onCompleteMove(slotIdx) : actions.onOpenCreateModal(slotIdx))}
      >
        <span class="empty-plus">${renderIcon(isMoveMode ? 'swap' : 'plus', 'slot-action-svg')}</span>
        <span class="empty-label">
          ${isMoveMode ? `Move Here (Slot ${slotIdx + 1})` : `Add Button (Slot ${slotIdx + 1})`}
        </span>
      </button>
    `;
  }

  const color = resolveButtonColors(btn);
  const fgMode = btn.customColor && btn.customColor.fgMode !== 'custom' ? 'auto' : 'preset';
  const styleVars = `--pad-bg:${color.bg};--pad-fg:${color.fg};--pad-border:${color.border};`;

  return html`
    <div
      class="parent-slot parent-slot-filled"
      data-moving-source=${isSelectedSource ? 'true' : 'false'}
      data-move-target=${isMoveMode && !isSelectedSource ? 'true' : 'false'}
      data-fg-mode=${fgMode}
      style=${styleVars}
    >
      <div class="parent-slot-top">
        <span class="slot-badge">Slot ${slotIdx + 1}</span>
        <span class="audio-badge">${btn.hasAudio ? 'Voice' : 'TTS'}</span>
      </div>
      <div class="parent-slot-preview">
        ${renderIcon(btn.iconId, 'parent-pad-icon')}
        <span class="parent-pad-label">${btn.label}</span>
      </div>
      <div class="parent-slot-actions">
        ${isMoveMode
          ? html`<button
              type="button"
              class="slot-btn slot-btn-primary"
              @click=${() => (isSelectedSource ? actions.onCancelMove() : actions.onCompleteMove(slotIdx))}
            >${isSelectedSource ? 'Cancel Move' : 'Swap Here'}</button>`
          : html`
              <button type="button" class="slot-btn" aria-label=${`Preview ${btn.label}`} @click=${() => actions.onPreviewButton(btn)}>
                ${renderIcon('play', 'btn-inline-svg')} Test
              </button>
              <button type="button" class="slot-btn" @click=${() => actions.onStartMove(btn.id)}>
                ${renderIcon('swap', 'btn-inline-svg')} Move
              </button>
              <button type="button" class="slot-btn slot-btn-primary" @click=${() => actions.onOpenEditModal(btn)}>
                Edit
              </button>
            `}
      </div>
    </div>
  `;
}

export function boardView(state, actions) {
  const density = state.settings.gridDensity;
  const { slots, parked } = buildGridSlots(state.buttons, density);

  if (state.mode === 'pet') {
    return html`
      <main class="pet-viewport">
        ${!state.audioUnlocked
          ? html`
              <div class="audio-unlock-banner" role="region" aria-label="Soundboard audio activation">
                <button
                  type="button"
                  class="audio-unlock-btn"
                  @pointerdown=${() => actions.onUnlockAudio()}
                  @keydown=${(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      actions.onUnlockAudio();
                    }
                  }}
                >
                  ${renderIcon('volume', 'unlock-vol-svg')}
                  <span>
                    <strong>Tap to Activate Soundboard</strong>
                    <small>Enables instant zero-latency audio &amp; keeps screen awake</small>
                  </span>
                </button>
              </div>
            `
          : null}

        <section class="soundboard-grid" data-density=${density} aria-label="Pet communication buttons">
          ${slots.map((btn) =>
            btn
              ? renderPetPad(btn, state.flashingButtonId === btn.id, state.attentionButtonId === btn.id, actions)
              : html`<div class="pet-pad-spacer" aria-hidden="true"></div>`
          )}
        </section>

        ${lockButtonView(state.lockProgress, actions.lockController)}
      </main>
    `;
  }

  return html`
    <div class="parent-shell">
      <header class="parent-toolbar">
        <div class="toolbar-brand">
          <span class="mode-pill">${renderIcon('unlock', 'pill-svg')} Parent Mode</span>
          ${state.movingButtonId
            ? html`<span class="move-banner" role="status">
                Tap another slot to move/swap
                <button type="button" class="link-btn" @click=${actions.onCancelMove}>Cancel</button>
              </span>`
            : null}
        </div>

        <div class="toolbar-controls">
          <div class="control-group" role="group" aria-label="Buttons per screen">
            <span class="control-caption">Grid:</span>
            ${GRID_DENSITIES.map(
              (n) => html`<button
                type="button"
                class="density-chip"
                aria-pressed=${density === n ? 'true' : 'false'}
                @click=${() => actions.onChangeDensity(n)}
              >${n}</button>`
            )}
          </div>

          <label class="control-group" for="cooldown-select">
            <span class="control-caption">Cooldown:</span>
            <select
              id="cooldown-select"
              class="toolbar-select"
              .value=${String(state.settings.cooldownMs)}
              @change=${(e) => actions.onChangeCooldown(Number(e.target.value))}
            >
              ${COOLDOWN_OPTIONS.map(
                (ms) => html`<option value=${ms} ?selected=${state.settings.cooldownMs === ms}>${ms}ms</option>`
              )}
            </select>
          </label>
          ${attentionCueControlView(state, actions)}

          <button type="button" class="toolbar-btn" @click=${actions.onAutoColorBoard}>
            ${renderIcon('palette', 'btn-inline-svg')} Auto-Color
          </button>
          <button type="button" class="toolbar-btn" @click=${actions.onOpenVoiceModal}>
            ${renderIcon('tune', 'btn-inline-svg')} Voice Tune
          </button>
          <button type="button" class="toolbar-btn" @click=${actions.onOpenActivityModal}>
            ${renderIcon('chart', 'btn-inline-svg')} Logs &amp; Backup
          </button>
          <button
            type="button"
            class="toolbar-btn"
            ?hidden=${!state.canInstallApp}
            aria-disabled=${state.installingApp ? 'true' : 'false'}
            @click=${actions.onInstallApp}
          >Install App</button>
          <button type="button" class="toolbar-btn toolbar-btn-done" @click=${actions.onExitParentMode}>
            ${renderIcon('lock', 'btn-inline-svg')} Lock (Pet Mode)
          </button>
        </div>
      </header>

      <main class="parent-main">
        ${parentLoadingStatusView(state, actions)}

        <section class="soundboard-grid soundboard-grid-parent" data-density=${density} aria-label="Editable button slots">
          ${slots.map((btn, idx) => renderParentSlot(btn, idx, state.movingButtonId, actions))}
        </section>

        ${parked.length > 0
          ? html`
              <aside class="parked-drawer" aria-label="Parked buttons outside current grid size">
                <h2 class="parked-title">Parked Buttons (${parked.length}) — saved outside ${density}-slot grid</h2>
                <div class="parked-list">
                  ${parked.map(
                    (btn) => html`
                      <div class="parked-chip">
                        <span><strong>${btn.label}</strong> (${btn.hasAudio ? 'Voice' : 'TTS'})</span>
                        <button type="button" class="slot-btn" @click=${() => actions.onStartMove(btn.id)}>Place on Grid</button>
                        <button type="button" class="slot-btn" @click=${() => actions.onOpenEditModal(btn)}>Edit</button>
                      </div>
                    `
                  )}
                </div>
              </aside>
            `
          : null}
      </main>
    </div>
  `;
}
