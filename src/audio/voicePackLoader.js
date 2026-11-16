import {
  getAllCachedVoiceClips,
  putCachedVoiceClip,
  resetVoicePackMemoryForTests,
} from '../storage/voicePackStore.js';

const EXPECTED_CORE_KEYS = [
  'outside',
  'eat',
  'water',
  'treat',
  'play',
  'ball',
  'frisbee',
  'come',
  'sit',
  'stay',
  'up',
  'down',
  'okay',
  'no',
];

const voicePackBuffers = new Map();
const rawClipCache = new Map();
const aliasToKey = new Map();
let packReady = false;
let inFlightPromise = null;

export function normalizePhraseKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function registerClipAliases(key, text, aliases = []) {
  const cleanKey = normalizePhraseKey(key);
  if (cleanKey) aliasToKey.set(cleanKey, key);
  const cleanText = normalizePhraseKey(text);
  if (cleanText) aliasToKey.set(cleanText, key);
  for (const alias of aliases) {
    const norm = normalizePhraseKey(alias);
    if (norm) aliasToKey.set(norm, key);
  }
}

export function isVoicePackReady() {
  return packReady;
}

export async function ensureVoicePackDecoded(decodeBufferFn) {
  if (typeof decodeBufferFn !== 'function') return;
  for (const [key, rawBuffer] of rawClipCache.entries()) {
    if (!voicePackBuffers.has(key) && rawBuffer) {
      try {
        const decoded = await decodeBufferFn(rawBuffer);
        if (decoded) voicePackBuffers.set(key, decoded);
      } catch {
        // Keep raw buffer for future retry when AudioContext is active
      }
    }
  }
}

export async function hydrateCachedVoicePack(decodeBufferFn) {
  const rows = await getAllCachedVoiceClips();
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ready: false, count: 0 };
  }

  const byKey = new Map(rows.map((r) => [r.key, r]));
  const hasAllCore = EXPECTED_CORE_KEYS.every((k) => byKey.get(k)?.buffer?.byteLength > 0);
  if (!hasAllCore) {
    return { ready: false, count: rows.length };
  }

  for (const row of rows) {
    if (row.buffer?.byteLength > 0) {
      rawClipCache.set(row.key, row.buffer);
      registerClipAliases(row.key, row.text, row.aliases);
    }
  }

  await ensureVoicePackDecoded(decodeBufferFn);
  packReady = true;
  return { ready: true, count: rows.length };
}

export function loadHumanVoicePack({
  manifestUrl = '/voice-pack/manifest.json',
  fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  decodeBufferFn,
  onProgress,
} = {}) {
  if (packReady) {
    const total = rawClipCache.size;
    onProgress?.({ completed: total, total });
    return Promise.resolve({ ready: true, total });
  }
  if (inFlightPromise) return inFlightPromise;
  if (!fetchImpl) {
    return Promise.reject(new Error('Network fetch is unavailable in this environment.'));
  }

  inFlightPromise = (async () => {
    try {
      const manifestRes = await fetchImpl(manifestUrl);
      if (!manifestRes.ok) {
        throw new Error(`Could not load voice pack manifest (${manifestRes.status}).`);
      }
      const manifest = await manifestRes.json();
      const clips = Array.isArray(manifest?.clips) ? manifest.clips : [];
      if (clips.length === 0) {
        throw new Error('Voice pack manifest contains no audio clips.');
      }

      const existingRows = await getAllCachedVoiceClips();
      const cachedByKey = new Map(
        existingRows
          .filter((r) => r.version === manifest.version && r.buffer?.byteLength > 0)
          .map((r) => [r.key, r])
      );

      const total = clips.length;
      onProgress?.({ completed: 0, total });

      for (let i = 0; i < clips.length; i += 1) {
        const meta = clips[i];
        let buffer = cachedByKey.get(meta.key)?.buffer;

        if (!buffer) {
          const clipRes = await fetchImpl(meta.url);
          if (!clipRes.ok) {
            throw new Error(`Failed to download "${meta.text}" (${clipRes.status}).`);
          }
          buffer = await clipRes.arrayBuffer();
          await putCachedVoiceClip({
            key: meta.key,
            version: manifest.version,
            text: meta.text,
            aliases: meta.aliases,
            mimeType: meta.mimeType || 'audio/mpeg',
            buffer,
          });
        }

        rawClipCache.set(meta.key, buffer);
        registerClipAliases(meta.key, meta.text, meta.aliases);
        if (typeof decodeBufferFn === 'function') {
          try {
            const decoded = await decodeBufferFn(buffer);
            if (decoded) voicePackBuffers.set(meta.key, decoded);
          } catch {
            // Decoded lazily once AudioContext unlocks
          }
        }

        onProgress?.({ completed: i + 1, total, clipKey: meta.key });
      }

      packReady = true;
      return { ready: true, total };
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

export function getHumanVoiceClipEntry(phrase) {
  if (!packReady) return null;
  const norm = normalizePhraseKey(phrase);
  if (!norm) return null;
  const key = aliasToKey.get(norm) || (rawClipCache.has(norm) ? norm : null);
  if (!key) return null;
  return {
    key,
    audioBuffer: voicePackBuffers.get(key) || null,
    rawBuffer: rawClipCache.get(key) || null,
  };
}

export function cacheDecodedVoicePackClip(key, audioBuffer) {
  if (key && audioBuffer) voicePackBuffers.set(key, audioBuffer);
}

export function playHumanVoicePackPhrase(phrase, cfg, playBufferFn, decodeFn, onWillPlay) {
  if (cfg.voiceEngine !== 'human-pack' || !packReady) return false;
  const entry = getHumanVoiceClipEntry(phrase);
  if (!entry) return false;

  if (entry.audioBuffer) {
    onWillPlay?.();
    return playBufferFn(entry.audioBuffer, cfg);
  }
  if (entry.rawBuffer) {
    onWillPlay?.();
    decodeFn(entry.rawBuffer)
      .then((decoded) => {
        if (decoded) {
          cacheDecodedVoicePackClip(entry.key, decoded);
          playBufferFn(decoded, cfg);
        }
      })
      .catch(() => {});
    return true;
  }
  return false;
}

export function resetVoicePackLoaderForTests() {
  packReady = false;
  inFlightPromise = null;
  voicePackBuffers.clear();
  rawClipCache.clear();
  aliasToKey.clear();
  resetVoicePackMemoryForTests();
}
