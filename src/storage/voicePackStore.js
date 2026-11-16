import { openDb, reqToPromise, txDone } from './db.js';

const memVoicePack = new Map();

export async function getAllCachedVoiceClips() {
  const db = await openDb();
  if (!db || !db.objectStoreNames.contains('voicePack')) {
    return [...memVoicePack.values()];
  }
  const tx = db.transaction('voicePack', 'readonly');
  const rows = await reqToPromise(tx.objectStore('voicePack').getAll());
  return rows || [];
}

export async function putCachedVoiceClip(record) {
  const entry = {
    key: String(record.key),
    version: String(record.version),
    text: String(record.text || record.key),
    aliases: Array.isArray(record.aliases) ? [...record.aliases] : [String(record.key)],
    mimeType: record.mimeType || 'audio/mpeg',
    buffer: record.buffer,
  };
  const db = await openDb();
  if (!db || !db.objectStoreNames.contains('voicePack')) {
    memVoicePack.set(entry.key, entry);
    return;
  }
  const tx = db.transaction('voicePack', 'readwrite');
  tx.objectStore('voicePack').put(entry);
  await txDone(tx);
}

export async function clearCachedVoiceClips() {
  memVoicePack.clear();
  const db = await openDb();
  if (!db || !db.objectStoreNames.contains('voicePack')) return;
  const tx = db.transaction('voicePack', 'readwrite');
  tx.objectStore('voicePack').clear();
  await txDone(tx);
}

export function resetVoicePackMemoryForTests() {
  memVoicePack.clear();
}
