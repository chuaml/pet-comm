import { preloadAllAudio } from '../audio/audioEngine.js';
import { parseAndValidateBackup, serializeBackup } from '../storage/backup.js';
import { clearActivityLogs, replaceAllData } from '../storage/db.js';

export function createActivityActions(state, setState) {
  return {
    onOpenActivityModal() {
      setState({
        activityModalOpen: true,
        confirmClearLogs: false,
        pendingImport: null,
        backupStatus: '',
      });
    },

    onCloseActivityModal() {
      setState({ activityModalOpen: false, confirmClearLogs: false, pendingImport: null });
    },

    onActivityNativeClose(e) {
      e.target.returnValue = '';
      if (state.activityModalOpen) {
        setState({ activityModalOpen: false, confirmClearLogs: false, pendingImport: null });
      }
    },

    onRequestClearLogs: () => setState({ confirmClearLogs: true }),
    onCancelClearLogs: () => setState({ confirmClearLogs: false }),

    async onConfirmClearLogs() {
      await clearActivityLogs();
      setState({ logs: [], confirmClearLogs: false, backupStatus: 'Activity history cleared.' });
    },

    async onExportBackup() {
      const json = await serializeBackup({
        settings: state.settings,
        buttons: state.buttons,
        audioMap: state.audioMap,
        logs: state.logs,
      });
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `pet-comm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState({ backupStatus: 'Backup exported successfully.' });
    },

    async onImportFileSelected(e) {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const parsed = parseAndValidateBackup(await file.text());
        setState({ pendingImport: parsed, backupStatus: '' });
      } catch (err) {
        setState({ pendingImport: null, backupStatus: err.message || 'Invalid backup file.' });
      }
    },

    onCancelImport: () => setState({ pendingImport: null }),

    async onConfirmImport() {
      const incoming = state.pendingImport;
      if (!incoming) return;
      await replaceAllData(incoming);
      const nextAudioMap = new Map(incoming.audioEntries.map((a) => [a.buttonId, a]));
      await preloadAllAudio(nextAudioMap);
      setState({
        settings: incoming.settings,
        buttons: incoming.buttons,
        audioMap: nextAudioMap,
        logs: incoming.logs,
        pendingImport: null,
        backupStatus: `Restored ${incoming.buttons.length} buttons.`,
      });
    },
  };
}
