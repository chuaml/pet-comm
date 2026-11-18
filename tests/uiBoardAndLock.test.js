import { render } from 'lit-html';
import { describe, expect, it, vi } from 'vitest';
import { boardView } from '../src/ui/board.js';
import { createHoldUnlockController } from '../src/ui/lock.js';
import { createDefaultButtons, DEFAULT_SETTINGS } from '../src/utils/defaults.js';

function makeBaseState(overrides = {}) {
  return {
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
  };
}

function makeStubActions(overrides = {}) {
  return {
    onUnlockAudio: vi.fn(),
    onPetPress: vi.fn(),
    onChangeDensity: vi.fn(),
    onChangeCooldown: vi.fn(),
    onChangeAttentionCue: vi.fn(),
    onAutoColorBoard: vi.fn(),
    onOpenVoiceModal: vi.fn(),
    onOpenActivityModal: vi.fn(),
    onExitParentMode: vi.fn(),
    onInstallApp: vi.fn(),
    onPreviewButton: vi.fn(),
    onStartMove: vi.fn(),
    onCancelMove: vi.fn(),
    onCompleteMove: vi.fn(),
    onOpenCreateModal: vi.fn(),
    onOpenEditModal: vi.fn(),
    lockController: {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerEnd: vi.fn(),
      onKeyDown: vi.fn(),
      onKeyUp: vi.fn(),
    },
    ...overrides,
  };
}

describe('boardView & hold-unlock UI interactions', () => {
  it('renders 16-slot Pet Mode with 14 pads + 2 spacers, custom RGB vars, and pointerdown trigger', () => {
    const buttons = createDefaultButtons(1000);
    buttons[0].customColor = { bgHex: '#2AA898', fgMode: 'auto', fgHex: '#0B1F3A' };
    const state = makeBaseState({ buttons, audioUnlocked: false });
    const actions = makeStubActions();

    render(boardView(state, actions), document.getElementById('test-root'));

    expect(document.querySelector('.audio-unlock-banner')).not.toBeNull();
    const pads = document.querySelectorAll('.pet-pad');
    const spacers = document.querySelectorAll('.pet-pad-spacer');
    expect(pads).toHaveLength(14);
    expect(spacers).toHaveLength(2);
    expect(pads[0].getAttribute('data-fg-mode')).toBe('auto');
    expect(pads[0].getAttribute('style')).toContain('--pad-bg:#2AA898');

    // Ignore secondary mouse button (right click)
    pads[0].dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
    expect(actions.onPetPress).not.toHaveBeenCalled();

    // Trigger immediately on primary pointerdown
    pads[0].dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    expect(actions.onPetPress).toHaveBeenCalledTimes(1);
    expect(actions.onPetPress).toHaveBeenCalledWith(buttons[0]);

    // Activation banner unlocks on click (touch grants activation on release), not on pointerdown
    const unlockBtn = document.querySelector('.audio-unlock-btn');
    unlockBtn.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    expect(actions.onUnlockAudio).not.toHaveBeenCalled();
    unlockBtn.click();
    expect(actions.onUnlockAudio).toHaveBeenCalledTimes(1);
  });

  it('replays the first touch on pointerup only while the page has never been activated', () => {
    const buttons = createDefaultButtons(1000);
    const actions = makeStubActions();
    const activation = { hasBeenActive: false };
    Object.defineProperty(navigator, 'userActivation', { value: activation, configurable: true });
    try {
      render(boardView(makeBaseState({ buttons }), actions), document.getElementById('test-root'));
      const pad = document.querySelector('.pet-pad');
      const fire = (type, pointerId) =>
        pad.dispatchEvent(new PointerEvent(type, { button: 0, pointerId, bubbles: true }));

      // First touch: pointerdown is not activated, the release is
      fire('pointerdown', 7);
      activation.hasBeenActive = true;
      fire('pointerup', 7);
      expect(actions.onPetPress).toHaveBeenCalledTimes(1);
      expect(actions.onPreviewButton).toHaveBeenCalledTimes(1);
      expect(actions.onPreviewButton).toHaveBeenCalledWith(buttons[0]);

      // Later touches are already activated on pointerdown: no replay
      fire('pointerdown', 8);
      fire('pointerup', 8);
      expect(actions.onPetPress).toHaveBeenCalledTimes(2);
      expect(actions.onPreviewButton).toHaveBeenCalledTimes(1);

      // A cancelled first touch is not replayed
      activation.hasBeenActive = false;
      fire('pointerdown', 9);
      fire('pointercancel', 9);
      activation.hasBeenActive = true;
      fire('pointerup', 9);
      expect(actions.onPreviewButton).toHaveBeenCalledTimes(1);
    } finally {
      delete navigator.userActivation;
    }
  });

  it('unlocks Parent Mode after holding corner lock for 3000ms and cancels on drift', () => {
    vi.useFakeTimers();
    const progresses = [];
    const onUnlock = vi.fn();

    const lockController = createHoldUnlockController({
      holdMs: 3000,
      maxDriftPx: 28,
      onProgress: (p) => progresses.push(p),
      onUnlock,
    });

    // Drift beyond 28px cancels hold
    lockController.onPointerDown({
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      stopPropagation: vi.fn(),
    });
    lockController.onPointerMove({ pointerId: 1, clientX: 140, clientY: 100 });
    vi.advanceTimersByTime(3500);
    expect(onUnlock).not.toHaveBeenCalled();

    // Steady 3000ms hold unlocks Parent Mode
    lockController.onPointerDown({
      button: 0,
      pointerId: 2,
      clientX: 100,
      clientY: 100,
      stopPropagation: vi.fn(),
    });
    vi.advanceTimersByTime(3100);
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(progresses.some((p) => p > 0)).toBe(true);
  });

  it('renders Parent Mode toolbar controls, parks overflow buttons at 4 slots, and triggers Auto-Color', () => {
    const state = makeBaseState({
      mode: 'parent',
      settings: { ...DEFAULT_SETTINGS, gridDensity: 4 },
    });
    const actions = makeStubActions();

    render(boardView(state, actions), document.getElementById('test-root'));

    const chips = [...document.querySelectorAll('.density-chip')].map((el) => el.textContent.trim());
    expect(chips).toEqual(['4', '9', '12', '16', '20']);

    // 4 active slots + 10 parked buttons in drawer
    expect(document.querySelectorAll('.parent-slot')).toHaveLength(4);
    expect(document.querySelectorAll('.parked-chip')).toHaveLength(10);

    const autoColorBtn = [...document.querySelectorAll('.toolbar-btn')].find((b) =>
      b.textContent.includes('Auto-Color')
    );
    autoColorBtn.click();
    expect(actions.onAutoColorBoard).toHaveBeenCalledTimes(1);
  });
});
