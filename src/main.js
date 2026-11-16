import { html, render } from 'lit-html';
import {
  isAudioUnlocked,
  preloadAllAudio,
  stopActiveAudio,
  triggerButtonSound,
  unlockAudioEngine,
} from './audio/audioEngine.js';
import { appendActivityLog, initStorage, saveButtons, saveSettings } from './storage/db.js';
import './style.css';
import './styles/lock.css';
import './styles/parent.css';
import './styles/dialogs.css';
import './styles/activity.css';
import { createActivityActions } from './ui/activityController.js';
import { activityDialogView, installLightDismissFallback } from './ui/activityModal.js';
import { boardView } from './ui/board.js';
import { editorDialogView } from './ui/editor.js';
import { createEditorActions } from './ui/editorController.js';
import { createHoldUnlockController } from './ui/lock.js';
import { DEFAULT_SETTINGS, swapOrMoveButtonSlot } from './utils/defaults.js';

const appRoot = document.getElementById('app');
let wakeLockSentinel = null;
let flashTimer = null;
let deferredInstallPrompt = null;

const supportsWebInstall =
  typeof Navigator !== 'undefined' && typeof Navigator.prototype.install === 'function';

const state = {
  mode: 'pet',
  audioUnlocked: false,
  lockProgress: 0,
  settings: { ...DEFAULT_SETTINGS },
  buttons: [],
  audioMap: new Map(),
  logs: [],
  flashingButtonId: null,
  movingButtonId: null,
  editorDraft: null,
  activityModalOpen: false,
  confirmClearLogs: false,
  pendingImport: null,
  backupStatus: '',
  canInstallApp: supportsWebInstall,
  installingApp: false,
};

function syncModalElement(id, shouldOpen) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (id === 'activity-dialog') installLightDismissFallback(dialog);
  if (shouldOpen && !dialog.open) dialog.showModal();
  else if (!shouldOpen && dialog.open) dialog.close();
}

function setState(patch) {
  Object.assign(state, patch);
  render(
    html`
      ${boardView(state, actions)}
      ${editorDialogView(state, actions)}
      ${activityDialogView(state, actions)}
    `,
    appRoot
  );
  syncModalElement('editor-dialog', Boolean(state.editorDraft));
  syncModalElement('activity-dialog', state.activityModalOpen);
}

async function syncWakeLock() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  if (state.mode === 'pet' && document.visibilityState === 'visible') {
    if (wakeLockSentinel && !wakeLockSentinel.released) return;
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
    } catch {
      wakeLockSentinel = null;
    }
  } else if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignore release errors
    }
    wakeLockSentinel = null;
  }
}

const lockController = createHoldUnlockController({
  holdMs: 3000,
  onProgress: (pct) => setState({ lockProgress: pct }),
  onUnlock: () => {
    stopActiveAudio();
    setState({ mode: 'parent', lockProgress: 0, movingButtonId: null });
    syncWakeLock();
  },
});

const editorActions = createEditorActions(state, setState);
const activityActions = createActivityActions(state, setState);

const actions = {
  ...editorActions,
  ...activityActions,
  lockController,

  async onUnlockAudio() {
    const unlocked = await unlockAudioEngine();
    setState({ audioUnlocked: unlocked });
    syncWakeLock();
  },

  async onPetPress(btn) {
    if (!state.audioUnlocked) {
      unlockAudioEngine().then((unlocked) => setState({ audioUnlocked: unlocked }));
    }
    syncWakeLock();
    const outcome = triggerButtonSound(btn, { cooldownMs: state.settings.cooldownMs });
    if (!outcome.played) return;

    if (flashTimer) clearTimeout(flashTimer);
    setState({ flashingButtonId: btn.id });
    flashTimer = setTimeout(() => setState({ flashingButtonId: null }), 180);

    const entry = await appendActivityLog({
      buttonId: btn.id,
      label: btn.label,
      timestamp: Date.now(),
    });
    setState({ logs: [entry, ...state.logs].slice(0, 5000) });
  },

  onExitParentMode() {
    editorActions.cancelActiveRecording();
    setState({ mode: 'pet', movingButtonId: null, editorDraft: null, activityModalOpen: false });
    syncWakeLock();
  },

  async onChangeDensity(gridDensity) {
    const settings = { ...state.settings, gridDensity };
    setState({ settings, movingButtonId: null });
    await saveSettings(settings);
  },

  async onChangeCooldown(cooldownMs) {
    const settings = { ...state.settings, cooldownMs };
    setState({ settings });
    await saveSettings(settings);
  },

  onPreviewButton: (btn) => triggerButtonSound(btn, { bypassGuards: true }),
  onStartMove: (buttonId) => setState({ movingButtonId: buttonId }),
  onCancelMove: () => setState({ movingButtonId: null }),

  async onCompleteMove(targetSlotIdx) {
    if (!state.movingButtonId) return;
    const updated = swapOrMoveButtonSlot(state.buttons, state.movingButtonId, targetSlotIdx);
    setState({ buttons: updated, movingButtonId: null });
    await saveButtons(updated);
  },

  async onInstallApp() {
    if (state.installingApp) return;
    setState({ installingApp: true });
    try {
      if (supportsWebInstall) {
        await navigator.install();
        setState({ canInstallApp: false });
      } else if (deferredInstallPrompt) {
        const promptEvt = deferredInstallPrompt;
        deferredInstallPrompt = null;
        await promptEvt.prompt();
        await promptEvt.userChoice;
        setState({ canInstallApp: Boolean(deferredInstallPrompt) });
      }
    } catch {
      // User dismissed installation prompt
    } finally {
      setState({ installingApp: false });
    }
  },
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!supportsWebInstall) setState({ canInstallApp: true });
});

document.addEventListener('visibilitychange', () => syncWakeLock());

async function bootstrap() {
  const hydrated = await initStorage();
  await preloadAllAudio(hydrated.audioMap);
  setState({
    settings: hydrated.settings,
    buttons: hydrated.buttons,
    audioMap: hydrated.audioMap,
    logs: hydrated.logs,
    audioUnlocked: isAudioUnlocked(),
  });
  syncWakeLock();

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

bootstrap();
