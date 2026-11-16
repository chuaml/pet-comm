import { decodeRawArrayBuffer, unlockAudioEngine } from './audioEngine.js';
import { processAudioBufferToWavBlob } from './wavUtils.js';

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/webm',
];

export function isRecordingSupported() {
  return (
    typeof window !== 'undefined' &&
    Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

export function pickSupportedMimeType() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }
  if (typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  for (const mime of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

export function createVoiceRecorder({ maxDurationMs = 5000, onTick, onFinish, onError } = {}) {
  let mediaRecorder = null;
  let stream = null;
  let chunks = [];
  let startedAt = 0;
  let tickTimer = null;
  let maxTimer = null;
  let canceled = false;

  const cleanupTimersAndStream = () => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      }
      stream = null;
    }
  };

  const start = async () => {
    if (!isRecordingSupported()) {
      throw new Error('Microphone recording is not supported in this browser.');
    }
    if (mediaRecorder && mediaRecorder.state === 'recording') return;

    canceled = false;
    chunks = [];
    await unlockAudioEngine();

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const negotiatedMime = pickSupportedMimeType();
    mediaRecorder = negotiatedMime
      ? new MediaRecorder(stream, { mimeType: negotiatedMime })
      : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onerror = (event) => {
      cleanupTimersAndStream();
      if (onError) onError(event.error || new Error('Recording failed.'));
    };

    mediaRecorder.onstop = async () => {
      const elapsedMs = Math.min(maxDurationMs, Math.max(100, Date.now() - startedAt));
      const actualMime = mediaRecorder?.mimeType || negotiatedMime || 'audio/webm';
      cleanupTimersAndStream();
      mediaRecorder = null;

      if (canceled || chunks.length === 0) return;

      try {
        const rawBlob = new Blob(chunks, { type: actualMime });
        const rawBuffer = await rawBlob.arrayBuffer();

        try {
          const decoded = await decodeRawArrayBuffer(rawBuffer);
          if (decoded && decoded.length > 0) {
            const wavResult = processAudioBufferToWavBlob(decoded);
            if (onFinish) onFinish(wavResult);
            return;
          }
        } catch {
          // Fallback to raw recorded format if browser cannot decode its own container
        }

        if (onFinish) {
          onFinish({
            blob: rawBlob,
            buffer: rawBuffer,
            mimeType: actualMime,
            durationMs: elapsedMs,
          });
        }
      } catch (err) {
        if (onError) onError(err);
      }
    };

    startedAt = Date.now();
    mediaRecorder.start(150);

    tickTimer = setInterval(() => {
      const elapsed = Math.min(maxDurationMs, Date.now() - startedAt);
      if (onTick) onTick(elapsed, maxDurationMs);
    }, 80);

    maxTimer = setTimeout(() => {
      stop();
    }, maxDurationMs);
  };

  const stop = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    } else {
      cleanupTimersAndStream();
    }
  };

  const cancel = () => {
    canceled = true;
    stop();
  };

  const isActive = () => Boolean(mediaRecorder && mediaRecorder.state === 'recording');

  return { start, stop, cancel, isActive };
}
