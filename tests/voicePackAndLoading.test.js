import { html, render } from 'lit-html';
import { describe, expect, it, vi } from 'vitest';
import { triggerButtonSound } from '../src/audio/audioEngine.js';
import {
  getHumanVoiceClipEntry,
  hydrateCachedVoicePack,
  isVoicePackReady,
  loadHumanVoicePack,
  resetVoicePackLoaderForTests,
} from '../src/audio/voicePackLoader.js';
import {
  acknowledgeLoadingTask,
  beginLoadingTask,
  completeLoadingTask,
  failLoadingTask,
  getLoadingTask,
  progressLoadingTask,
  VOICE_PACK_TASK_ID,
} from '../src/state/loadingStatus.js';
import { parentLoadingStatusView } from '../src/ui/loadingStatusView.js';
import { createVoiceActions } from '../src/ui/voiceController.js';
import { voiceDialogView } from '../src/ui/voiceModal.js';
import { DEFAULT_SETTINGS } from '../src/utils/defaults.js';
import { BUTTON_TYPE_PRESETS } from '../src/utils/presets.js';

function makeManifestPayload() {
  const keys = [
    ...BUTTON_TYPE_PRESETS.map((p) => ({
      key: p.id === 'ok' ? 'okay' : p.id,
      text: p.ttsText,
      aliases: [p.label.toLowerCase(), p.ttsText.toLowerCase()],
      url: `/voice-pack/${p.id === 'ok' ? 'okay' : p.id}.mp3`,
    })),
  ];
  return { version: 'test-v1', clips: keys };
}

describe('Loading Status Subsystem & On-Demand Cached Human Voice Pack', () => {
  it('tracks loading task lifecycle (idle -> loading percent -> readyUnread -> acknowledged / error)', () => {
    let tasks = {};
    expect(getLoadingTask(tasks).phase).toBe('idle');

    tasks = beginLoadingTask(tasks, VOICE_PACK_TASK_ID, { label: 'Voice Pack' });
    expect(getLoadingTask(tasks).phase).toBe('loading');

    tasks = progressLoadingTask(tasks, VOICE_PACK_TASK_ID, { completed: 7, total: 14 });
    expect(getLoadingTask(tasks).percent).toBe(50);

    tasks = completeLoadingTask(tasks, VOICE_PACK_TASK_ID, { total: 14, notify: true });
    expect(getLoadingTask(tasks)).toMatchObject({
      phase: 'ready',
      percent: 100,
      readyUnread: true,
    });

    tasks = acknowledgeLoadingTask(tasks, VOICE_PACK_TASK_ID);
    expect(getLoadingTask(tasks).readyUnread).toBe(false);

    tasks = failLoadingTask(tasks, VOICE_PACK_TASK_ID, 'Network offline');
    expect(getLoadingTask(tasks)).toMatchObject({ phase: 'error', message: 'Network offline' });
  });

  it('downloads clips with progress, caches them in IndexedDB, and re-hydrates offline with 0 fetches', async () => {
    const manifest = makeManifestPayload();
    const progressEvents = [];
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('manifest.json')) {
        return { ok: true, json: async () => manifest };
      }
      const bytes = new Uint8Array([1, 2, 3, 4, url.length]).buffer;
      return { ok: true, arrayBuffer: async () => bytes };
    });

    const decodeStub = vi.fn(async (buf) => ({ duration: 0.4, byteLength: buf.byteLength }));

    const res = await loadHumanVoicePack({
      fetchImpl: fetchMock,
      decodeBufferFn: decodeStub,
      onProgress: (p) => progressEvents.push(p),
    });

    expect(res.ready).toBe(true);
    expect(isVoicePackReady()).toBe(true);
    expect(progressEvents.at(0)).toEqual({ completed: 0, total: 14 });
    expect(progressEvents.at(-1)).toMatchObject({ completed: 14, total: 14 });
    expect(getHumanVoiceClipEntry('OK')?.key).toBe('okay');
    expect(getHumanVoiceClipEntry('Okay')?.audioBuffer).not.toBeNull();

    // Simulate page reload: clear in-memory loader state, keep IndexedDB intact!
    const callsBeforeReload = fetchMock.mock.calls.length;
    resetVoicePackLoaderForTests();
    expect(isVoicePackReady()).toBe(false);

    const hydrated = await hydrateCachedVoicePack(decodeStub);
    expect(hydrated.ready).toBe(true);
    expect(isVoicePackReady()).toBe(true);
    expect(fetchMock.mock.calls.length).toBe(callsBeforeReload);
  });

  it('keeps OS audio active while loading, blocks switching until 100% done, and shows Ready indicator', async () => {
    const spokenOs = [];
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => [{ name: 'Samantha', voiceURI: 'sam', lang: 'en-US', localService: true }],
        cancel: vi.fn(),
        speak: (u) => spokenOs.push(u.text),
      },
      configurable: true,
    });

    // Gate clip download behind a controllable promise so we can test mid-download state!
    let resolveDownloads;
    const gatePromise = new Promise((r) => {
      resolveDownloads = r;
    });
    const manifest = makeManifestPayload();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('manifest.json')) return { ok: true, json: async () => manifest };
        await gatePromise;
        return { ok: true, arrayBuffer: async () => new Uint8Array([9, 8, 7, 6]).buffer };
      })
    );

    const state = {
      settings: { ...DEFAULT_SETTINGS },
      availableVoices: [{ name: 'Samantha', voiceURI: 'sam', lang: 'en-US', localService: true }],
      loadingTasks: {},
      voiceModalOpen: true,
    };

    let actions = {};
    const setState = (patch) => {
      Object.assign(state, patch);
      render(
        html`${parentLoadingStatusView(state, actions)} ${voiceDialogView(state, actions)}`,
        document.getElementById('test-root')
      );
    };
    actions = createVoiceActions(state, setState);
    setState({});

    // Before loading: switching to human-pack is blocked & button is disabled
    await actions.onSelectVoiceEngine('human-pack');
    expect(state.settings.voiceEngine).toBe('os');
    const packCardBefore = [...document.querySelectorAll('.voice-engine-card')][1];
    expect(packCardBefore.disabled).toBe(true);

    // Start manual background load
    const loadPromise = actions.onLoadHumanVoicePack();
    await new Promise((r) => setTimeout(r, 10));

    // Mid-download: progress bar is visible, switching is STILL blocked, and OS audio STILL runs!
    expect(document.querySelectorAll('progress.task-progress-bar').length).toBeGreaterThanOrEqual(1);
    await actions.onSelectVoiceEngine('human-pack');
    expect(state.settings.voiceEngine).toBe('os');

    const playBtn = { id: 'btn-play', label: 'Play', ttsText: 'Play', hasAudio: false };
    expect(triggerButtonSound(playBtn, { bypassGuards: true, voiceSettings: state.settings })).toEqual({
      played: true,
      mode: 'tts',
    });
    expect(spokenOs).toContain('Play');

    // Finish background download -> Ready notification indicator appears & switching unlocks!
    resolveDownloads();
    await loadPromise;

    const readyBanner = document.querySelector('.loading-status-banner[data-phase="ready"]');
    expect(readyBanner).not.toBeNull();
    expect(readyBanner.textContent).toContain('Ready to switch');

    const packCardAfter = [...document.querySelectorAll('.voice-engine-card')][1];
    expect(packCardAfter.disabled).toBe(false);

    await actions.onSelectVoiceEngine('human-pack');
    await new Promise((r) => setTimeout(r, 15));
    expect(state.settings.voiceEngine).toBe('human-pack');
    expect(document.querySelector('.loading-status-banner[data-phase="ready"]')).toBeNull();
  });
});
