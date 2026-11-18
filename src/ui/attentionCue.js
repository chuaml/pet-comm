import { html } from 'lit-html';
import { saveSettings } from '../storage/db.js';
import { buildGridSlots, normalizeAttentionCueSec } from '../utils/defaults.js';

export const ATTENTION_PULSE_MS = 2400;

/** Newest-first logs -> id of the most recently pressed button still visible on the grid. */
export function pickAttentionTarget(logs, buttons, gridDensity) {
  const { slots } = buildGridSlots(buttons || [], gridDensity);
  const visibleIds = new Set(slots.filter(Boolean).map((btn) => btn.id));
  const entry = (logs || []).find((log) => visibleIds.has(log.buttonId));
  return entry ? entry.buttonId : null;
}

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

export function createAttentionCueActions(state, setState) {
  let idleTimer = null;
  let pulseTimer = null;
  let activeKey = '';

  const clearTimers = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (pulseTimer) clearTimeout(pulseTimer);
    idleTimer = null;
    pulseTimer = null;
  };

  const intervalSec = () => normalizeAttentionCueSec(state.settings?.attentionCueSec);
  const isEnabled = () => state.mode === 'pet' && intervalSec() > 0 && isDocumentVisible();

  const endPulse = () => {
    pulseTimer = null;
    if (state.attentionButtonId) setState({ attentionButtonId: null });
  };

  const startCountdown = () => {
    clearTimers();
    if (!isEnabled()) return;
    idleTimer = setTimeout(() => {
      const targetId = pickAttentionTarget(state.logs, state.buttons, state.settings.gridDensity);
      startCountdown();
      if (!targetId) return;
      pulseTimer = setTimeout(endPulse, ATTENTION_PULSE_MS);
      setState({ attentionButtonId: targetId });
    }, intervalSec() * 1000);
  };

  return {
    /** Safe to call on every render: only restarts when mode, interval, or visibility changed. */
    syncAttentionCue() {
      const key = isEnabled() ? `on:${intervalSec()}` : 'off';
      if (key === activeKey) return;
      activeKey = key;
      startCountdown();
      if (state.attentionButtonId) setState({ attentionButtonId: null });
    },

    noteAttentionPress() {
      startCountdown();
      if (state.attentionButtonId) setState({ attentionButtonId: null });
    },

    async onChangeAttentionCue(rawValue) {
      const settings = { ...state.settings, attentionCueSec: normalizeAttentionCueSec(rawValue) };
      setState({ settings });
      await saveSettings(settings);
    },
  };
}

export function attentionCueControlView(state, actions) {
  return html`
    <label class="control-group" for="attention-cue-input">
      <span class="control-caption">Remind every (sec, 0 = off):</span>
      <input
        id="attention-cue-input"
        class="attention-cue-input"
        type="number"
        inputmode="numeric"
        min="0"
        max="3600"
        step="1"
        .value=${String(state.settings.attentionCueSec ?? 0)}
        @change=${(e) => {
          actions.onChangeAttentionCue(e.target.value);
          e.target.value = String(normalizeAttentionCueSec(e.target.value));
        }}
      />
    </label>
  `;
}
