import { render } from 'lit-html';
import { describe, expect, it, vi } from 'vitest';
import {
  ATTENTION_PULSE_MS,
  createAttentionCueActions,
  pickAttentionTarget,
} from '../src/ui/attentionCue.js';
import { boardView } from '../src/ui/board.js';
import {
  createDefaultButtons,
  DEFAULT_SETTINGS,
  normalizeAttentionCueSec,
  normalizeSettings,
} from '../src/utils/defaults.js';

function makeHarness(overrides = {}) {
  const buttons = createDefaultButtons(1000);
  const state = {
    mode: 'pet',
    settings: { ...DEFAULT_SETTINGS, attentionCueSec: 10 },
    buttons,
    logs: [{ buttonId: buttons[2].id, label: buttons[2].label, timestamp: 2 }],
    attentionButtonId: null,
    ...overrides,
  };
  const setState = vi.fn((patch) => Object.assign(state, patch));
  return { state, setState, buttons, cue: createAttentionCueActions(state, setState) };
}

describe('attention cue settings & target selection', () => {
  it('defaults to off and clamps the interval to 0 or 5..3600 seconds', () => {
    expect(DEFAULT_SETTINGS.attentionCueSec).toBe(0);
    expect(normalizeAttentionCueSec(0)).toBe(0);
    expect(normalizeAttentionCueSec(-20)).toBe(0);
    expect(normalizeAttentionCueSec('abc')).toBe(0);
    expect(normalizeAttentionCueSec(undefined)).toBe(0);
    expect(normalizeAttentionCueSec(3)).toBe(5);
    expect(normalizeAttentionCueSec('45')).toBe(45);
    expect(normalizeAttentionCueSec(99999)).toBe(3600);
    expect(normalizeSettings({}).attentionCueSec).toBe(0);
    expect(normalizeSettings({ attentionCueSec: 90 }).attentionCueSec).toBe(90);
  });

  it('picks the newest press that is still visible, skipping deleted and parked buttons', () => {
    const buttons = createDefaultButtons(1000);
    const logs = [
      { buttonId: 'deleted-btn', timestamp: 4 },
      { buttonId: buttons[9].id, timestamp: 3 },
      { buttonId: buttons[1].id, timestamp: 2 },
      { buttonId: buttons[0].id, timestamp: 1 },
    ];
    expect(pickAttentionTarget(logs, buttons, 16)).toBe(buttons[9].id);
    expect(pickAttentionTarget(logs, buttons, 4)).toBe(buttons[1].id);
    expect(pickAttentionTarget([], buttons, 16)).toBeNull();
    expect(pickAttentionTarget(undefined, buttons, 16)).toBeNull();
  });
});

describe('attention cue controller', () => {
  it('pulses the last pressed pad after the idle interval, clears it, and repeats', () => {
    vi.useFakeTimers();
    const { state, buttons, cue } = makeHarness();
    cue.syncAttentionCue();

    vi.advanceTimersByTime(9999);
    expect(state.attentionButtonId).toBeNull();
    vi.advanceTimersByTime(1);
    expect(state.attentionButtonId).toBe(buttons[2].id);

    vi.advanceTimersByTime(ATTENTION_PULSE_MS);
    expect(state.attentionButtonId).toBeNull();

    vi.advanceTimersByTime(10000 - ATTENTION_PULSE_MS);
    expect(state.attentionButtonId).toBe(buttons[2].id);
  });

  it('restarts the countdown and stops an active pulse when a pad is pressed', () => {
    vi.useFakeTimers();
    const { state, buttons, cue } = makeHarness();
    cue.syncAttentionCue();

    vi.advanceTimersByTime(8000);
    cue.noteAttentionPress();
    vi.advanceTimersByTime(9999);
    expect(state.attentionButtonId).toBeNull();
    vi.advanceTimersByTime(1);
    expect(state.attentionButtonId).toBe(buttons[2].id);

    cue.noteAttentionPress();
    expect(state.attentionButtonId).toBeNull();
    vi.advanceTimersByTime(ATTENTION_PULSE_MS);
    expect(state.attentionButtonId).toBeNull();
  });

  it('stays silent when off, in Parent Mode, with no history, or while the page is hidden', () => {
    vi.useFakeTimers();
    const off = makeHarness({ settings: { ...DEFAULT_SETTINGS, attentionCueSec: 0 } });
    const parent = makeHarness({ mode: 'parent' });
    const noHistory = makeHarness({ logs: [] });
    for (const h of [off, parent, noHistory]) h.cue.syncAttentionCue();
    vi.advanceTimersByTime(60000);
    for (const h of [off, parent, noHistory]) expect(h.setState).not.toHaveBeenCalled();

    const hidden = makeHarness();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    hidden.cue.syncAttentionCue();
    vi.advanceTimersByTime(60000);
    expect(hidden.state.attentionButtonId).toBeNull();

    visibility.mockReturnValue('visible');
    hidden.cue.syncAttentionCue();
    vi.advanceTimersByTime(10000);
    expect(hidden.state.attentionButtonId).toBe(hidden.buttons[2].id);
  });

  it('stops pulsing on unlock to Parent Mode and applies a changed interval', async () => {
    // Leave setImmediate real so the IndexedDB write inside saveSettings can settle.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { state, buttons, cue } = makeHarness();
    cue.syncAttentionCue();
    vi.advanceTimersByTime(10000);
    expect(state.attentionButtonId).toBe(buttons[2].id);

    state.mode = 'parent';
    cue.syncAttentionCue();
    expect(state.attentionButtonId).toBeNull();
    vi.advanceTimersByTime(60000);
    expect(state.attentionButtonId).toBeNull();

    await cue.onChangeAttentionCue('3');
    expect(state.settings.attentionCueSec).toBe(5);
    state.mode = 'pet';
    cue.syncAttentionCue();
    vi.advanceTimersByTime(5000);
    expect(state.attentionButtonId).toBe(buttons[2].id);
  });
});

describe('attention cue board rendering', () => {
  const baseState = (overrides) => ({
    mode: 'pet',
    audioUnlocked: true,
    lockProgress: 0,
    settings: { ...DEFAULT_SETTINGS },
    buttons: createDefaultButtons(1000),
    flashingButtonId: null,
    attentionButtonId: null,
    movingButtonId: null,
    canInstallApp: false,
    installingApp: false,
    ...overrides,
  });
  const lockController = {
    onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerEnd: vi.fn(), onKeyDown: vi.fn(), onKeyUp: vi.fn(),
  };

  it('marks only the target pad with data-attention in Pet Mode', () => {
    const state = baseState();
    state.attentionButtonId = state.buttons[3].id;
    render(boardView(state, { lockController, onPetPress: vi.fn() }), document.getElementById('test-root'));

    const marked = document.querySelectorAll('.pet-pad[data-attention="true"]');
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('aria-label')).toBe(state.buttons[3].label);
  });

  it('renders the Parent Mode seconds field and reports changes', () => {
    const onChangeAttentionCue = vi.fn();
    const state = baseState({ mode: 'parent', settings: { ...DEFAULT_SETTINGS, attentionCueSec: 30 } });
    render(boardView(state, { lockController, onChangeAttentionCue }), document.getElementById('test-root'));

    const input = document.getElementById('attention-cue-input');
    expect(input.value).toBe('30');
    input.value = '2';
    input.dispatchEvent(new Event('change'));
    expect(onChangeAttentionCue).toHaveBeenCalledWith('2');
    expect(input.value).toBe('5');
  });
});
