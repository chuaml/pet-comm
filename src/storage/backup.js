import { normalizeCustomColor } from '../utils/colors.js';
import {
  getColorPreset,
  isValidIconId,
  normalizeSettings,
  PET_ICONS,
} from '../utils/defaults.js';

const BACKUP_APP_ID = 'pet-comm';
const BACKUP_VERSION = 1;

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/=\s]*$/.test(base64)) {
    throw new Error('Invalid base64 audio payload.');
  }
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function serializeBackup({ settings, buttons, audioMap, logs = [] }) {
  const serializedButtons = [];
  for (const btn of buttons) {
    const audioRec = audioMap.get(btn.id);
    let audio = null;
    if (btn.hasAudio && audioRec) {
      const buffer = audioRec.buffer || (await audioRec.blob.arrayBuffer());
      audio = {
        mimeType: audioRec.mimeType || 'audio/wav',
        durationMs: audioRec.durationMs || 0,
        dataBase64: arrayBufferToBase64(buffer),
      };
    }
    serializedButtons.push({
      id: btn.id,
      label: btn.label,
      ttsText: btn.ttsText || btn.label,
      colorId: btn.colorId,
      customColor: normalizeCustomColor(btn.customColor),
      iconId: btn.iconId,
      slotIndex: btn.slotIndex,
      updatedAt: btn.updatedAt || Date.now(),
      audio,
    });
  }

  const payload = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: normalizeSettings(settings),
    buttons: serializedButtons,
    activityLog: logs.slice(0, 5000).map((entry) => ({
      buttonId: String(entry.buttonId || ''),
      label: String(entry.label || ''),
      timestamp: Number(entry.timestamp) || Date.now(),
    })),
  };

  return JSON.stringify(payload, null, 2);
}

export function parseAndValidateBackup(jsonString) {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    throw new Error('Backup file is empty.');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version !== BACKUP_VERSION) {
    throw new Error('Unsupported backup format or version.');
  }
  if (!Array.isArray(parsed.buttons)) {
    throw new Error('Backup file is missing a buttons array.');
  }

  const settings = normalizeSettings(parsed.settings);

  const seenIds = new Set();
  const usedSlots = new Set();
  const buttons = [];
  const audioEntries = [];

  for (let i = 0; i < parsed.buttons.length; i += 1) {
    const raw = parsed.buttons[i];
    if (!raw || typeof raw !== 'object') continue;

    const label = String(raw.label || '').trim().slice(0, 32);
    if (!label) continue;

    let id = String(raw.id || `btn-import-${i}`).trim();
    if (seenIds.has(id)) id = `${id}-${i}`;
    seenIds.add(id);

    let slotIndex = Number.isInteger(raw.slotIndex) && raw.slotIndex >= 0 ? raw.slotIndex : i;
    while (usedSlots.has(slotIndex)) slotIndex += 1;
    usedSlots.add(slotIndex);

    let hasAudio = false;
    if (raw.audio && typeof raw.audio.dataBase64 === 'string' && raw.audio.dataBase64.length > 0) {
      const buffer = base64ToArrayBuffer(raw.audio.dataBase64);
      const mimeType = String(raw.audio.mimeType || 'audio/wav');
      const blob = new Blob([buffer], { type: mimeType });
      audioEntries.push({
        buttonId: id,
        buffer,
        blob,
        mimeType,
        durationMs: Number(raw.audio.durationMs) || 0,
      });
      hasAudio = true;
    }

    buttons.push({
      id,
      label,
      ttsText: String(raw.ttsText || label).trim().slice(0, 80) || label,
      colorId: getColorPreset(raw.colorId).id,
      customColor: normalizeCustomColor(raw.customColor),
      iconId: isValidIconId(raw.iconId) ? raw.iconId : PET_ICONS[0].id,
      slotIndex,
      hasAudio,
      updatedAt: Number(raw.updatedAt) || Date.now(),
    });
  }

  const logs = Array.isArray(parsed.activityLog)
    ? parsed.activityLog
        .filter((item) => item && item.label && Number.isFinite(Number(item.timestamp)))
        .slice(0, 5000)
        .map((item) => ({
          buttonId: String(item.buttonId || ''),
          label: String(item.label).slice(0, 32),
          timestamp: Number(item.timestamp),
        }))
    : [];

  return { settings, buttons, audioEntries, logs };
}
