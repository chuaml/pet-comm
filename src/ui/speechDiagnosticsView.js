import { html } from 'lit-html';
import { formatSpeechReport, summarizeSpeechDiagnostics } from '../state/speechDiagnostics.js';

function formatMs(value) {
  if (value === null || value === undefined) return 'No speech yet';
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
}

/** Parent Mode only: shows how long the device voice took to start, for diagnosing slow first presses. */
export function speechDiagnosticsView(state, actions) {
  const summary = summarizeSpeechDiagnostics();
  const report = formatSpeechReport({ voices: state.availableVoices || [], settings: state.settings });

  return html`
    <details class="panel-card speech-diag" @toggle=${actions.onRefreshSpeechDiagnostics}>
      <summary class="speech-diag-summary">Speech diagnostics</summary>
      <p class="field-hint">
        Time from a press to the device voice starting. Reopen this section to refresh the numbers.
      </p>
      <dl class="speech-diag-list">
        <div><dt>Latest start</dt><dd>${formatMs(summary.latestStartMs)}</dd></div>
        <div><dt>Slowest start</dt><dd>${formatMs(summary.slowestStartMs)}</dd></div>
        <div><dt>Last error</dt><dd>${summary.lastError || 'None'}</dd></div>
        <div><dt>Voice used</dt><dd>${summary.lastVoiceName || 'No speech yet'}</dd></div>
        <div><dt>Silent warm-ups</dt><dd>${summary.prime.count}</dd></div>
      </dl>
      <textarea
        class="speech-diag-report"
        readonly
        rows="6"
        aria-label="Speech report text"
        .value=${report}
      ></textarea>
      <div class="speech-diag-actions">
        <button type="button" class="slot-btn" @click=${actions.onCopySpeechReport}>Copy report</button>
        <span class="field-hint" role="status">${state.speechReportStatus || ''}</span>
      </div>
    </details>
  `;
}
