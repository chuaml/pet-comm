import {
  cacheButtonAudio,
  previewAudioPayload,
  removeCachedAudio,
  stopActiveAudio,
} from '../audio/audioEngine.js';
import { createVoiceRecorder } from '../audio/recorder.js';
import { deleteButton, saveButtonWithAudio } from '../storage/db.js';
import { PET_COLORS, PET_ICONS } from '../utils/defaults.js';

export function createEditorActions(state, setState) {
  let activeRecorder = null;
  let recordPressStartedAt = 0;

  const updateDraft = (patch) => {
    if (!state.editorDraft) return;
    setState({ editorDraft: { ...state.editorDraft, ...patch } });
  };

  const cancelActiveRecording = () => {
    if (activeRecorder?.isActive()) {
      activeRecorder.cancel();
    }
    activeRecorder = null;
  };

  return {
    cancelActiveRecording,

    onOpenCreateModal(slotIndex) {
      const color = PET_COLORS[slotIndex % PET_COLORS.length];
      const icon = PET_ICONS[slotIndex % PET_ICONS.length];
      setState({
        editorDraft: {
          isNew: true,
          id: `btn-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`,
          slotIndex,
          initialLabel: '',
          label: '',
          ttsText: '',
          colorId: color.id,
          iconId: icon.id,
          hasAudio: false,
          audioDurationMs: 0,
          pendingAudio: undefined,
          isRecording: false,
          recordingElapsedMs: 0,
          recordError: '',
          confirmDelete: false,
        },
      });
    },

    onOpenEditModal(btn) {
      const audioRec = state.audioMap.get(btn.id);
      setState({
        editorDraft: {
          isNew: false,
          id: btn.id,
          slotIndex: btn.slotIndex,
          initialLabel: btn.label,
          label: btn.label,
          ttsText: btn.ttsText || btn.label,
          colorId: btn.colorId,
          iconId: btn.iconId,
          hasAudio: Boolean(btn.hasAudio && audioRec),
          audioDurationMs: audioRec?.durationMs || 0,
          pendingAudio: undefined,
          isRecording: false,
          recordingElapsedMs: 0,
          recordError: '',
          confirmDelete: false,
        },
      });
    },

    onUpdateDraft: updateDraft,

    onCloseEditor() {
      cancelActiveRecording();
      stopActiveAudio();
      setState({ editorDraft: null });
    },

    onEditorNativeClose(e) {
      e.target.returnValue = '';
      if (state.editorDraft) {
        cancelActiveRecording();
        stopActiveAudio();
        setState({ editorDraft: null });
      }
    },

    onRecordPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      if (activeRecorder?.isActive()) {
        activeRecorder.stop();
        return;
      }
      recordPressStartedAt = Date.now();
      activeRecorder = createVoiceRecorder({
        maxDurationMs: 5000,
        onTick: (elapsed) => updateDraft({ recordingElapsedMs: elapsed }),
        onFinish: (audioResult) => {
          updateDraft({
            isRecording: false,
            recordingElapsedMs: 0,
            hasAudio: true,
            audioDurationMs: audioResult.durationMs,
            pendingAudio: audioResult,
            recordError: '',
          });
        },
        onError: (err) => {
          updateDraft({
            isRecording: false,
            recordingElapsedMs: 0,
            recordError: err?.message || 'Microphone access was denied or unavailable.',
          });
        },
      });
      updateDraft({ isRecording: true, recordingElapsedMs: 0, recordError: '' });
      activeRecorder.start().catch((err) => {
        updateDraft({
          isRecording: false,
          recordError: err?.message || 'Could not start microphone recording.',
        });
      });
    },

    onRecordPointerUp() {
      if (!activeRecorder?.isActive()) return;
      if (Date.now() - recordPressStartedAt >= 300) {
        activeRecorder.stop();
      }
    },

    onRecordKeyDown(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (activeRecorder?.isActive()) activeRecorder.stop();
        else this.onRecordPointerDown(e);
      }
    },

    onPreviewDraftAudio() {
      const draft = state.editorDraft;
      if (!draft) return;
      const payload =
        draft.pendingAudio !== undefined
          ? draft.pendingAudio
          : draft.hasAudio
            ? state.audioMap.get(draft.id)
            : null;
      previewAudioPayload(payload, draft.ttsText || draft.label || 'Button');
    },

    onClearDraftAudio() {
      updateDraft({ hasAudio: false, audioDurationMs: 0, pendingAudio: null });
    },

    async onSaveEditor(e) {
      e.preventDefault();
      const draft = state.editorDraft;
      if (!draft) return;
      cancelActiveRecording();

      const cleanLabel = draft.label.trim();
      if (!cleanLabel) return;

      const savedBtn = {
        id: draft.id,
        label: cleanLabel,
        ttsText: draft.ttsText.trim() || cleanLabel,
        colorId: draft.colorId,
        iconId: draft.iconId,
        slotIndex: draft.slotIndex,
        hasAudio: Boolean(draft.hasAudio),
        updatedAt: Date.now(),
      };

      const nextButtons = draft.isNew
        ? [...state.buttons, savedBtn]
        : state.buttons.map((b) => (b.id === savedBtn.id ? savedBtn : b));
      const nextAudioMap = new Map(state.audioMap);

      if (draft.pendingAudio === null) {
        nextAudioMap.delete(savedBtn.id);
        removeCachedAudio(savedBtn.id);
      } else if (draft.pendingAudio) {
        const rec = { buttonId: savedBtn.id, ...draft.pendingAudio };
        nextAudioMap.set(savedBtn.id, rec);
        await cacheButtonAudio(savedBtn.id, rec);
      }

      setState({ buttons: nextButtons, audioMap: nextAudioMap, editorDraft: null });
      await saveButtonWithAudio(savedBtn, draft.pendingAudio);
    },

    async onConfirmDeleteButton() {
      const draft = state.editorDraft;
      if (!draft) return;
      cancelActiveRecording();
      const nextButtons = state.buttons.filter((b) => b.id !== draft.id);
      const nextAudioMap = new Map(state.audioMap);
      nextAudioMap.delete(draft.id);
      removeCachedAudio(draft.id);
      setState({ buttons: nextButtons, audioMap: nextAudioMap, editorDraft: null });
      await deleteButton(draft.id);
    },
  };
}
