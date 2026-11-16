import {
  resumeAudioContextSync,
  speakTtsFallback,
  stopActiveAudio,
} from '../audio/audioEngine.js';
import { listAvailableVoices } from '../audio/ttsVoice.js';
import { saveSettings } from '../storage/db.js';
import { normalizeSettings } from '../utils/defaults.js';
import { DEFAULT_VOICE_SETTINGS, VOICE_PRESETS } from '../utils/presets.js';

export function createVoiceActions(state, setState) {
  const applyVoicePatch = async (patch, previewWord = '') => {
    const settings = normalizeSettings({ ...state.settings, ...patch });
    setState({ settings });
    if (previewWord) {
      resumeAudioContextSync();
      speakTtsFallback(previewWord, settings, previewWord);
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
      await applyVoicePatch({ ...DEFAULT_VOICE_SETTINGS }, 'Okay');
    },

    onPreviewVoiceSample(word) {
      resumeAudioContextSync();
      speakTtsFallback(word, state.settings, word);
    },
  };
}
