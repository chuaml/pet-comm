import {
  decodeRawArrayBuffer,
  resumeAudioContextSync,
  speakTtsFallback,
  stopActiveAudio,
} from '../audio/audioEngine.js';
import { listAvailableVoices } from '../audio/ttsVoice.js';
import { isVoicePackReady, loadHumanVoicePack } from '../audio/voicePackLoader.js';
import {
  acknowledgeLoadingTask,
  beginLoadingTask,
  completeLoadingTask,
  failLoadingTask,
  progressLoadingTask,
  VOICE_PACK_TASK_ID,
} from '../state/loadingStatus.js';
import { saveSettings } from '../storage/db.js';
import { normalizeSettings } from '../utils/defaults.js';
import { DEFAULT_VOICE_SETTINGS, VOICE_PRESETS } from '../utils/presets.js';

export function createVoiceActions(state, setState) {
  const applyVoicePatch = async (patch, previewWord = '') => {
    const settings = normalizeSettings({ ...state.settings, ...patch });
    setState({ settings });
    if (previewWord) {
      resumeAudioContextSync();
      speakTtsFallback(previewWord, settings);
    }
    await saveSettings(settings);
  };

  return {
    onOpenVoiceModal() {
      stopActiveAudio();
      setState({
        voiceModalOpen: true,
        availableVoices: listAvailableVoices(),
      });
    },

    onCloseVoiceModal() {
      stopActiveAudio();
      setState({ voiceModalOpen: false });
    },

    onVoiceNativeClose(e) {
      e.target.returnValue = '';
      if (state.voiceModalOpen) {
        stopActiveAudio();
        setState({ voiceModalOpen: false });
      }
    },

    async onLoadHumanVoicePack() {
      setState({
        loadingTasks: beginLoadingTask(state.loadingTasks, VOICE_PACK_TASK_ID, {
          label: 'Human Voice Pack',
          message: 'Starting Human Voice Pack download…',
        }),
      });

      try {
        const result = await loadHumanVoicePack({
          decodeBufferFn: decodeRawArrayBuffer,
          onProgress: ({ completed, total }) => {
            setState({
              loadingTasks: progressLoadingTask(state.loadingTasks, VOICE_PACK_TASK_ID, {
                completed,
                total,
              }),
            });
          },
        });
        setState({
          loadingTasks: completeLoadingTask(state.loadingTasks, VOICE_PACK_TASK_ID, {
            total: result.total,
            notify: true,
          }),
        });
      } catch (err) {
        setState({
          loadingTasks: failLoadingTask(
            state.loadingTasks,
            VOICE_PACK_TASK_ID,
            err?.message || 'Failed to download Human Voice Pack.'
          ),
        });
      }
    },

    async onSelectVoiceEngine(engine) {
      if (engine === 'human-pack' && !isVoicePackReady()) {
        return;
      }
      const nextTasks =
        engine === 'human-pack'
          ? acknowledgeLoadingTask(state.loadingTasks, VOICE_PACK_TASK_ID)
          : state.loadingTasks;
      const settings = normalizeSettings({
        ...state.settings,
        voiceEngine: engine === 'human-pack' ? 'human-pack' : 'os',
      });
      setState({ settings, loadingTasks: nextTasks });
      resumeAudioContextSync();
      speakTtsFallback('Play', settings);
      await saveSettings(settings);
    },

    onDismissVoicePackReady() {
      setState({
        loadingTasks: acknowledgeLoadingTask(state.loadingTasks, VOICE_PACK_TASK_ID),
      });
    },

    async onSelectVoicePreset(presetId) {
      const preset = VOICE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      await applyVoicePatch(
        {
          ttsPitch: preset.pitch,
          ttsRate: preset.rate,
          ttsVolume: preset.volume,
        },
        'Play'
      );
    },

    async onUpdateVoiceSettings(patch) {
      const previewOnVoiceChange = typeof patch.voiceURI === 'string' ? 'Play' : '';
      await applyVoicePatch(patch, previewOnVoiceChange);
    },

    async onResetVoiceDefaults() {
      await applyVoicePatch(
        {
          ...DEFAULT_VOICE_SETTINGS,
          voiceEngine: state.settings.voiceEngine,
        },
        'Okay'
      );
    },

    onPreviewVoiceSample(word) {
      resumeAudioContextSync();
      speakTtsFallback(word, state.settings);
    },
  };
}
