import { html, render } from 'lit-html';
import {
  decodeRawArrayBuffer, isAudioUnlocked, preloadAllAudio, resumeAudioContextSync,
  stopActiveAudio, triggerButtonSound, unlockAudioEngine,
} from './audio/audioEngine.js';
import { listAvailableVoices, subscribeVoicesChanged, warmSpeechVoices } from './audio/ttsVoice.js';
import { createSpeechWarmActions } from './audio/ttsWarmup.js';
import { hydrateCachedVoicePack } from './audio/voicePackLoader.js';
import { completeLoadingTask, VOICE_PACK_TASK_ID } from './state/loadingStatus.js';
import { appendActivityLog, initStorage, saveButtons, saveSettings } from './storage/db.js';
import { createActivityActions } from './ui/activityController.js';
import { activityDialogView, installLightDismissFallback } from './ui/activityModal.js';
import { createAttentionCueActions } from './ui/attentionCue.js';
import { boardView } from './ui/board.js';
import { editorDialogView } from './ui/editor.js';
import { createEditorActions } from './ui/editorController.js';
import { createHoldUnlockController } from './ui/lock.js';
import { createVoiceActions } from './ui/voiceController.js';
import { voiceDialogView } from './ui/voiceModal.js';
import { autoColorBoardButtons } from './utils/autoColor.js';
import { DEFAULT_SETTINGS, swapOrMoveButtonSlot } from './utils/defaults.js';
import './style.css';
import './styles/lock.css';
import './styles/parent.css';
import './styles/dialogs.css';
import './styles/activity.css';
import './styles/voiceAndPresets.css';
import './styles/colorPicker.css';
import './styles/loadingStatus.css';
import './styles/attentionCue.css';

const appRoot = document.getElementById('app');
let wakeLockSentinel = null;
let flashTimer = null;
let deferredInstallPrompt = null;
const supportsWebInstall =
  typeof Navigator !== 'undefined' && typeof Navigator.prototype.install === 'function';

const state = {
  mode: 'pet', audioUnlocked: false, lockProgress: 0,
  settings: { ...DEFAULT_SETTINGS }, buttons: [], audioMap: new Map(), logs: [],
  availableVoices: [], loadingTasks: {}, flashingButtonId: null, attentionButtonId: null, movingButtonId: null,
  editorDraft: null, voiceModalOpen: false, activityModalOpen: false, speechReportStatus: '',
  confirmClearLogs: false, pendingImport: null, backupStatus: '',
  canInstallApp: supportsWebInstall, installingApp: false,
};

function syncModalElement(id, shouldOpen) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (id === 'activity-dialog' || id === 'voice-dialog') installLightDismissFallback(dialog);
  if (shouldOpen && !dialog.open) dialog.showModal();
  else if (!shouldOpen && dialog.open) dialog.close();
}

function setState(patch) {
  Object.assign(state, patch);
  render(
    html`${boardView(state, actions)}${editorDialogView(state, actions)}${voiceDialogView(
      state,
      actions
    )}${activityDialogView(state, actions)}`,
    appRoot
  );
  syncModalElement('editor-dialog', Boolean(state.editorDraft));
  syncModalElement('voice-dialog', state.voiceModalOpen);
  syncModalElement('activity-dialog', state.activityModalOpen);
  attentionActions.syncAttentionCue();
  speechWarm.syncSpeechWarm();
}

async function syncWakeLock() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  if (state.mode === 'pet' && document.visibilityState === 'visible') {
    if (wakeLockSentinel && !wakeLockSentinel.released) return;
    wakeLockSentinel = await navigator.wakeLock.request('screen').catch(() => null);
  } else if (wakeLockSentinel) {
    await wakeLockSentinel.release().catch(() => {});
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
const voiceActions = createVoiceActions(state, setState);
const activityActions = createActivityActions(state, setState);
const attentionActions = createAttentionCueActions(state, setState);
const speechWarm = createSpeechWarmActions(state);

const actions = {
  ...editorActions,
  ...voiceActions,
  ...activityActions,
  ...attentionActions,
  lockController,

  async onUnlockAudio() {
    const unlocked = await unlockAudioEngine();
    setState({ audioUnlocked: unlocked, availableVoices: listAvailableVoices() });
    syncWakeLock();
  },

  async onPetPress(btn) {
    if (!state.audioUnlocked) {
      resumeAudioContextSync().then((unlocked) => {
        if (unlocked !== state.audioUnlocked) setState({ audioUnlocked: unlocked });
      });
    }
    syncWakeLock();
    const outcome = triggerButtonSound(btn, {
      cooldownMs: state.settings.cooldownMs,
      voiceSettings: state.settings,
    });
    if (!outcome.played) return;
    attentionActions.noteAttentionPress();

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
    stopActiveAudio();
    setState({
      mode: 'pet',
      movingButtonId: null,
      editorDraft: null,
      voiceModalOpen: false,
      activityModalOpen: false,
    });
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

  async onAutoColorBoard() {
    const buttons = autoColorBoardButtons(state.buttons, state.settings.gridDensity);
    setState({ buttons, movingButtonId: null });
    await saveButtons(buttons);
  },

  onPreviewButton: (btn) => {
    if (!state.audioUnlocked) resumeAudioContextSync();
    return triggerButtonSound(btn, { bypassGuards: true, voiceSettings: state.settings });
  },
  onStartMove: (buttonId) => setState({ movingButtonId: buttonId }),
  onCancelMove: () => setState({ movingButtonId: null }),

  async onCompleteMove(targetSlotIdx) {
    if (!state.movingButtonId) return;
    const buttons = swapOrMoveButtonSlot(state.buttons, state.movingButtonId, targetSlotIdx);
    setState({ buttons, movingButtonId: null });
    await saveButtons(buttons);
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
      // User dismissed
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

document.addEventListener('visibilitychange', () => {
  syncWakeLock();
  attentionActions.syncAttentionCue();
  speechWarm.syncSpeechWarm();
});

async function bootstrap() {
  warmSpeechVoices();
  subscribeVoicesChanged((availableVoices) => setState({ availableVoices }));
  const [hydrated, cachedPack] = await Promise.all([
    initStorage(),
    hydrateCachedVoicePack(decodeRawArrayBuffer),
  ]);
  await preloadAllAudio(hydrated.audioMap);
  const loadingTasks = cachedPack.ready
    ? completeLoadingTask({}, VOICE_PACK_TASK_ID, { total: cachedPack.count, notify: false })
    : {};
  const settings =
    hydrated.settings.voiceEngine === 'human-pack' && !cachedPack.ready
      ? { ...hydrated.settings, voiceEngine: 'os' }
      : hydrated.settings;
  setState({
    settings,
    buttons: hydrated.buttons,
    audioMap: hydrated.audioMap,
    logs: hydrated.logs,
    loadingTasks,
    availableVoices: listAvailableVoices(),
    audioUnlocked: isAudioUnlocked(),
  });
  syncWakeLock();

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

bootstrap();
