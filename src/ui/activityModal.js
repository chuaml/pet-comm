import { html } from 'lit-html';
import { renderIcon } from './icons.js';

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

function summarizeLogs(logs) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  let todayTotal = 0;
  const byWord = new Map();

  for (const item of logs) {
    const isToday = item.timestamp >= todayMs;
    if (isToday) todayTotal += 1;
    const prev = byWord.get(item.label) || { label: item.label, total: 0, today: 0 };
    prev.total += 1;
    if (isToday) prev.today += 1;
    byWord.set(item.label, prev);
  }

  const ranked = [...byWord.values()].sort((a, b) => b.total - a.total);
  const maxCount = ranked[0]?.total || 1;
  return { todayTotal, total: logs.length, ranked, maxCount };
}

export function installLightDismissFallback(dialog) {
  if (!dialog || dialog.dataset.lightDismissBound === 'true') return;
  dialog.dataset.lightDismissBound = 'true';

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const isOutside = (event) => {
      const rect = dialog.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (event) => {
      pressedOutside = event.target === dialog && isOutside(event);
    });
    dialog.addEventListener('pointerup', (event) => {
      if (pressedOutside && event.target === dialog && isOutside(event)) {
        dialog.close();
      }
      pressedOutside = false;
    });
  }
}

export function activityDialogView(state, actions) {
  const stats = summarizeLogs(state.logs);

  return html`
    <dialog
      id="activity-dialog"
      class="app-dialog"
      closedby="any"
      aria-labelledby="activity-dialog-title"
      @close=${actions.onActivityNativeClose}
    >
      <div class="dialog-header">
        <h2 id="activity-dialog-title" class="dialog-title">Activity Log &amp; Board Backup</h2>
        <button
          type="button"
          class="dialog-close-btn"
          aria-label="Close activity and backup dialog"
          @click=${actions.onCloseActivityModal}
        >
          ✕
        </button>
      </div>

      <div class="activity-dialog-body">
        <section class="panel-card" aria-labelledby="backup-sec-title">
          <h3 id="backup-sec-title" class="section-heading">Board Configuration &amp; Audio Backup</h3>
          <p class="field-hint">
            Export or restore all button layouts, custom voice clips, and press logs in a single
            portable <code>.json</code> file.
          </p>

          <div class="backup-actions">
            <button type="button" class="btn-primary" @click=${actions.onExportBackup}>
              Export .json Backup
            </button>

            <label class="slot-btn file-picker-label" for="backup-file-input">
              Import .json Backup
            </label>
            <input
              id="backup-file-input"
              class="visually-hidden"
              type="file"
              accept=".json,application/json"
              @change=${actions.onImportFileSelected}
            />
          </div>

          ${state.pendingImport
            ? html`
                <div class="import-confirm-box" role="region" aria-label="Confirm backup restore">
                  <p>
                    Ready to restore <strong>${state.pendingImport.buttons.length}</strong> buttons
                    (grid ${state.pendingImport.settings.gridDensity}) and
                    <strong>${state.pendingImport.logs.length}</strong> log entries. This will
                    replace the current board.
                  </p>
                  <div class="backup-actions">
                    <button type="button" class="btn-danger" @click=${actions.onConfirmImport}>
                      Replace Current Board
                    </button>
                    <button type="button" class="slot-btn" @click=${actions.onCancelImport}>
                      Cancel
                    </button>
                  </div>
                </div>
              `
            : null}

          <p class="backup-status" role="status">${state.backupStatus || ''}</p>
        </section>

        <section class="panel-card" aria-labelledby="stats-sec-title">
          <div class="stats-header-row">
            <h3 id="stats-sec-title" class="section-heading">Pet Press Activity</h3>
            ${state.logs.length > 0
              ? state.confirmClearLogs
                ? html`
                    <div class="inline-confirm">
                      <button type="button" class="btn-danger" @click=${actions.onConfirmClearLogs}>
                        Confirm Clear
                      </button>
                      <button
                        type="button"
                        class="slot-btn"
                        @click=${actions.onCancelClearLogs}
                      >
                        Cancel
                      </button>
                    </div>
                  `
                : html`
                    <button
                      type="button"
                      class="btn-danger-outline"
                      @click=${actions.onRequestClearLogs}
                    >
                      ${renderIcon('trash', 'btn-inline-svg')} Clear Log
                    </button>
                  `
              : null}
          </div>

          <div class="kpi-strip">
            <div class="kpi-box">
              <span class="kpi-num">${stats.todayTotal}</span>
              <span class="kpi-label">Today</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-num">${stats.total}</span>
              <span class="kpi-label">All-Time</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-num">${stats.ranked[0]?.label || '—'}</span>
              <span class="kpi-label">Top Word</span>
            </div>
          </div>

          ${stats.ranked.length === 0
            ? html`<p class="empty-log-msg">
                No Pet Mode presses recorded yet. Switch to Pet Mode and press any button!
              </p>`
            : html`
                <ul class="freq-list" aria-label="Most frequently used buttons">
                  ${stats.ranked.map(
                    (row) => html`
                      <li class="freq-item">
                        <div class="freq-meta">
                          <strong>${row.label}</strong>
                          <span>${row.today} today · ${row.total} total</span>
                        </div>
                        <div class="freq-bar-track" aria-hidden="true">
                          <div
                            class="freq-bar-fill"
                            style=${`inline-size:${Math.max(6, Math.round((row.total / stats.maxCount) * 100))}%`}
                          ></div>
                        </div>
                      </li>
                    `
                  )}
                </ul>

                <h4 class="recent-heading">Recent Presses</h4>
                <ul class="recent-log-list">
                  ${state.logs.slice(0, 40).map(
                    (entry) => html`
                      <li class="recent-log-item">
                        <strong>${entry.label}</strong>
                        <time datetime=${new Date(entry.timestamp).toISOString()}>
                          ${timeFormatter.format(entry.timestamp)}
                        </time>
                      </li>
                    `
                  )}
                </ul>
              `}
        </section>
      </div>
    </dialog>
  `;
}
