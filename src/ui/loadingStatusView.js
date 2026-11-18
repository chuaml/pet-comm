import { html } from 'lit-html';
import { isVoicePackReady } from '../audio/voicePackLoader.js';
import { getLoadingTask, VOICE_PACK_TASK_ID } from '../state/loadingStatus.js';

function resolveEffectiveEngine(state, task) {
  const ready = task.phase === 'ready' || isVoicePackReady();
  return state.settings.voiceEngine === 'human-pack' && ready ? 'human-pack' : 'os';
}

export function parentLoadingStatusView(state, actions) {
  const task = getLoadingTask(state.loadingTasks, VOICE_PACK_TASK_ID);
  const activeEngine = resolveEffectiveEngine(state, task);
  const osVoiceCount = (state.availableVoices || []).length;

  if (task.phase === 'loading') {
    return html`
      <div class="loading-status-banner" data-phase="loading" role="status">
        <div class="loading-status-main">
          <span id="parent-vp-progress-label" class="loading-status-text">
            <strong>Loading Human Voice Pack…</strong> ${task.percent}% (${task.completed}/${task.total} clips · current audio remains active)
          </span>
          <progress
            class="task-progress-bar"
            max="100"
            value=${task.percent}
            aria-labelledby="parent-vp-progress-label"
          ></progress>
        </div>
      </div>
    `;
  }

  if (task.phase === 'ready' && activeEngine !== 'human-pack' && task.readyUnread) {
    return html`
      <div class="loading-status-banner" data-phase="ready" role="status">
        <span class="loading-status-text">
          <strong>✓ Human Voice Pack loaded &amp; cached offline!</strong> Ready to switch whenever you like.
        </span>
        <div class="loading-status-actions">
          <button
            type="button"
            class="btn-primary"
            @click=${() => actions.onSelectVoiceEngine('human-pack')}
          >
            Switch to Human Voice
          </button>
          <button
            type="button"
            class="slot-btn"
            aria-label="Dismiss voice pack notification"
            @click=${actions.onDismissVoicePackReady}
          >
            Later
          </button>
        </div>
      </div>
    `;
  }

  if (task.phase === 'error') {
    return html`
      <div class="loading-status-banner" data-phase="error" role="alert">
        <span class="loading-status-text">
          <strong>Voice Pack download failed:</strong> ${task.message}
        </span>
        <button type="button" class="slot-btn" @click=${actions.onLoadHumanVoicePack}>
          Retry Load
        </button>
      </div>
    `;
  }

  if (task.phase === 'idle' && osVoiceCount === 0 && activeEngine === 'os') {
    return html`
      <div class="loading-status-banner" data-phase="notice" role="status">
        <span class="loading-status-text">
          <strong>No OS speech voices detected on this device.</strong> Load the pre-generated Human Voice Pack (~113 KB) to enable offline button speech.
        </span>
        <button type="button" class="btn-primary" @click=${actions.onLoadHumanVoicePack}>
          Load Human Voice Pack
        </button>
      </div>
    `;
  }

  return null;
}

export function voiceEngineSectionView(state, actions) {
  const task = getLoadingTask(state.loadingTasks, VOICE_PACK_TASK_ID);
  const packReady = task.phase === 'ready' || isVoicePackReady();
  const activeEngine = resolveEffectiveEngine(state, task);
  const osVoiceCount = (state.availableVoices || []).length;

  return html`
    <fieldset class="choice-fieldset">
      <legend>Voice Audio Source</legend>
      <div class="voice-engine-grid">
        <button
          type="button"
          class="voice-engine-card"
          aria-pressed=${activeEngine === 'os' ? 'true' : 'false'}
          @click=${() => actions.onSelectVoiceEngine('os')}
        >
          <strong>OS Offline Speech (Default)</strong>
          <small>
            ${osVoiceCount > 0
              ? `${osVoiceCount} system voice${osVoiceCount === 1 ? '' : 's'} available`
              : '0 OS voices detected on this device'}
          </small>
        </button>

        <button
          type="button"
          class="voice-engine-card"
          aria-pressed=${activeEngine === 'human-pack' ? 'true' : 'false'}
          ?disabled=${!packReady}
          @click=${() => actions.onSelectVoiceEngine('human-pack')}
        >
          <strong>Pre-Generated Human Voice Pack</strong>
          <small>
            ${packReady
              ? activeEngine === 'human-pack'
                ? 'Active · Cached offline (Ava)'
                : 'Loaded & ready to switch!'
              : task.phase === 'loading'
                ? `Loading… ${task.percent}% (available once complete)`
                : 'Load below to unlock switching (~113 KB)'}
          </small>
        </button>
      </div>

      ${!packReady && task.phase === 'idle'
        ? html`
            <div class="voice-pack-action-row">
              <button type="button" class="btn-primary" @click=${actions.onLoadHumanVoicePack}>
                Load Human Voice Pack (~113 KB)
              </button>
              <span class="field-hint">
                Downloads in the background &amp; caches in IndexedDB while current audio stays active.
                Recommended on tablets and Chromebooks: preset words then play instantly, even when the
                device voice is slow to wake after a long idle.
              </span>
            </div>
          `
        : null}

      ${task.phase === 'loading'
        ? html`
            <div class="voice-pack-progress-box" role="status">
              <span id="modal-vp-progress-label" class="loading-status-text">
                ${task.message} — current audio remains active while loading.
              </span>
              <progress
                class="task-progress-bar"
                max="100"
                value=${task.percent}
                aria-labelledby="modal-vp-progress-label"
              ></progress>
            </div>
          `
        : null}

      ${task.phase === 'error'
        ? html`
            <div class="voice-pack-action-row" role="alert">
              <span class="error-banner">${task.message}</span>
              <button type="button" class="slot-btn" @click=${actions.onLoadHumanVoicePack}>
                Retry Load
              </button>
            </div>
          `
        : null}

      ${packReady && activeEngine !== 'human-pack'
        ? html`
            <div class="voice-pack-ready-row" role="status">
              <span><strong>✓ Human Voice Pack cached &amp; ready!</strong></span>
              <button
                type="button"
                class="btn-primary"
                @click=${() => actions.onSelectVoiceEngine('human-pack')}
              >
                Switch to Human Voice
              </button>
            </div>
          `
        : null}
    </fieldset>
  `;
}
