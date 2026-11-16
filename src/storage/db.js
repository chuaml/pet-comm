import { createDefaultButtons, DEFAULT_SETTINGS } from '../utils/defaults.js';

const DB_NAME = 'pet-comm-db';
const DB_VERSION = 1;
const MAX_LOGS = 5000;

let dbPromise = null;
const mem = {
  initialized: false,
  settings: { ...DEFAULT_SETTINGS },
  buttons: new Map(),
  audio: new Map(),
  logs: [],
};

const reqToPromise = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const txDone = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });

async function openDb() {
  if (typeof indexedDB === 'undefined') return null;
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('buttons')) db.createObjectStore('buttons', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'buttonId' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('logs')) {
          db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true }).createIndex('byTimestamp', 'timestamp');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function normalizeAudioRecord(rec) {
  if (!rec) return null;
  const mimeType = rec.mimeType || 'audio/wav';
  const blob = rec.blob instanceof Blob ? rec.blob : new Blob([rec.buffer], { type: mimeType });
  return { buttonId: rec.buttonId, blob, buffer: rec.buffer || null, mimeType, durationMs: rec.durationMs || 0 };
}

export async function initStorage() {
  const db = await openDb();
  if (!db) {
    if (!mem.initialized) {
      for (const btn of createDefaultButtons()) mem.buttons.set(btn.id, btn);
      mem.initialized = true;
    }
    return {
      settings: { ...mem.settings },
      buttons: [...mem.buttons.values()],
      audioMap: new Map(mem.audio),
      logs: [...mem.logs],
    };
  }

  const readTx = db.transaction(['settings', 'buttons', 'audio', 'logs'], 'readonly');
  const [boardSettings, rawButtons, rawAudio, rawLogs] = await Promise.all([
    reqToPromise(readTx.objectStore('settings').get('board')),
    reqToPromise(readTx.objectStore('buttons').getAll()),
    reqToPromise(readTx.objectStore('audio').getAll()),
    reqToPromise(readTx.objectStore('logs').getAll()),
  ]);

  let settings = boardSettings ? { gridDensity: boardSettings.gridDensity, cooldownMs: boardSettings.cooldownMs } : null;
  let buttons = rawButtons || [];

  if (!boardSettings && buttons.length === 0) {
    settings = { ...DEFAULT_SETTINGS };
    buttons = createDefaultButtons();
    const seedTx = db.transaction(['settings', 'buttons'], 'readwrite');
    seedTx.objectStore('settings').put({ key: 'board', ...settings });
    for (const btn of buttons) seedTx.objectStore('buttons').put(btn);
    await txDone(seedTx);
  } else if (!settings) {
    settings = { ...DEFAULT_SETTINGS };
  }

  const audioMap = new Map();
  for (const item of rawAudio || []) {
    const norm = normalizeAudioRecord(item);
    if (norm) audioMap.set(norm.buttonId, norm);
  }
  const logs = (rawLogs || []).sort((a, b) => b.timestamp - a.timestamp);
  return { settings, buttons, audioMap, logs };
}

export async function saveSettings(settings) {
  const db = await openDb();
  if (!db) {
    mem.settings = { ...settings };
    return;
  }
  const tx = db.transaction('settings', 'readwrite');
  tx.objectStore('settings').put({ key: 'board', ...settings });
  await txDone(tx);
}

export async function saveButtons(buttons) {
  const db = await openDb();
  if (!db) {
    for (const btn of buttons) mem.buttons.set(btn.id, btn);
    return;
  }
  const tx = db.transaction('buttons', 'readwrite');
  const store = tx.objectStore('buttons');
  for (const btn of buttons) store.put(btn);
  await txDone(tx);
}

export async function saveButtonWithAudio(button, audioAction = undefined) {
  const buffer = audioAction?.blob ? await audioAction.blob.arrayBuffer() : audioAction?.buffer;
  const db = await openDb();
  if (!db) {
    mem.buttons.set(button.id, button);
    if (audioAction === null) mem.audio.delete(button.id);
    else if (audioAction && buffer) mem.audio.set(button.id, normalizeAudioRecord({ buttonId: button.id, buffer, ...audioAction }));
    return;
  }
  const tx = db.transaction(['buttons', 'audio'], 'readwrite');
  tx.objectStore('buttons').put(button);
  if (audioAction === null) {
    tx.objectStore('audio').delete(button.id);
  } else if (audioAction && buffer) {
    tx.objectStore('audio').put({
      buttonId: button.id,
      buffer,
      mimeType: audioAction.mimeType || 'audio/wav',
      durationMs: audioAction.durationMs || 0,
    });
  }
  await txDone(tx);
}

export async function deleteButton(buttonId) {
  const db = await openDb();
  if (!db) {
    mem.buttons.delete(buttonId);
    mem.audio.delete(buttonId);
    return;
  }
  const tx = db.transaction(['buttons', 'audio'], 'readwrite');
  tx.objectStore('buttons').delete(buttonId);
  tx.objectStore('audio').delete(buttonId);
  await txDone(tx);
}

export async function appendActivityLog(entry) {
  const record = { buttonId: entry.buttonId, label: entry.label, timestamp: entry.timestamp ?? Date.now() };
  const db = await openDb();
  if (!db) {
    mem.logs.unshift({ id: Date.now() + Math.random(), ...record });
    if (mem.logs.length > MAX_LOGS) mem.logs.length = MAX_LOGS;
    return record;
  }
  const tx = db.transaction('logs', 'readwrite');
  const store = tx.objectStore('logs');
  store.add(record);
  const count = await reqToPromise(store.count());
  if (count > MAX_LOGS) {
    const keys = await reqToPromise(store.getAllKeys(null, count - MAX_LOGS));
    for (const key of keys) store.delete(key);
  }
  await txDone(tx);
  return record;
}

export async function clearActivityLogs() {
  const db = await openDb();
  if (!db) {
    mem.logs = [];
    return;
  }
  const tx = db.transaction('logs', 'readwrite');
  tx.objectStore('logs').clear();
  await txDone(tx);
}

export async function replaceAllData({ settings, buttons, audioEntries, logs }) {
  const prepared = await Promise.all(
    audioEntries.map(async (e) => ({
      buttonId: e.buttonId,
      buffer: e.buffer || (await e.blob.arrayBuffer()),
      mimeType: e.mimeType || 'audio/wav',
      durationMs: e.durationMs || 0,
    }))
  );
  const db = await openDb();
  if (!db) {
    mem.settings = { ...settings };
    mem.buttons = new Map(buttons.map((b) => [b.id, b]));
    mem.audio = new Map(prepared.map((a) => [a.buttonId, normalizeAudioRecord(a)]));
    mem.logs = [...logs].slice(0, MAX_LOGS);
    mem.initialized = true;
    return;
  }
  const tx = db.transaction(['settings', 'buttons', 'audio', 'logs'], 'readwrite');
  for (const name of ['settings', 'buttons', 'audio', 'logs']) tx.objectStore(name).clear();
  tx.objectStore('settings').put({ key: 'board', ...settings });
  for (const btn of buttons) tx.objectStore('buttons').put(btn);
  for (const audio of prepared) tx.objectStore('audio').put(audio);
  for (const log of logs.slice(0, MAX_LOGS)) {
    tx.objectStore('logs').add({ buttonId: log.buttonId, label: log.label, timestamp: log.timestamp });
  }
  await txDone(tx);
}
