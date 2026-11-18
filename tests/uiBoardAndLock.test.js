import { render } from 'lit-html';
import { describe, expect, it, vi } from 'vitest';
import { boardView } from '../src/ui/board.js';
import { createDefaultButtons, DEFAULT_SETTINGS } from '../src/utils/defaults.js';

function makeBaseState(overrides = {}) {
  return {
    mode: 'pet',
    audioUnlocked: true,
    lock: { phase: 'idle', pct: 0, travelPx: 0 },
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
    onChangeGap: vi.fn(),
    onOpenPetProof: vi.fn(),
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
      onPointerUp: vi.fn(),
      onPointerCancel: vi.fn(),
      onKeyDown: vi.fn(),
      onKeyUp: vi.fn(),
      onBlur: vi.fn(),
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

  it('keeps the lock in its own strip above the grid and applies the gap setting in Pet Mode only', () => {
    const root = document.getElementById('test-root');
    const actions = makeStubActions();
    render(boardView(makeBaseState({ audioUnlocked: false }), actions), root);

    const viewport = document.querySelector('.pet-viewport');
    const strip = document.querySelector('.lock-strip');
    const grid = document.querySelector('.soundboard-grid');
    expect([...viewport.children]).toEqual([strip, grid]);
    expect(strip.querySelector('.corner-lock-btn')).not.toBeNull();
    expect(strip.querySelector('.audio-unlock-banner')).not.toBeNull();
    expect(grid.querySelector('.corner-lock-btn')).toBeNull();
    expect(grid.getAttribute('data-gap')).toBe('comfortable');

    const wide = makeBaseState({ settings: { ...DEFAULT_SETTINGS, padGap: 'extra-wide' } });
    render(boardView(wide, actions), root);
    expect(document.querySelector('.soundboard-grid').getAttribute('data-gap')).toBe('extra-wide');

    // An armed lock slides its thumb along the track and never fires a pad underneath
    const armed = makeBaseState({ lock: { phase: 'armed', pct: 95, travelPx: 186 } });
    render(boardView(armed, actions), root);
    const zone = document.querySelector('.corner-lock-zone');
    expect(zone.getAttribute('data-phase')).toBe('armed');
    expect(zone.getAttribute('style')).toContain('--lock-travel:186px;--slide-pct:95;');
    expect(document.querySelector('.corner-lock-btn').getAttribute('data-ready')).toBe('true');
    expect(document.querySelector('.lock-hold-hint').textContent).toContain('Slide left');

    render(boardView(makeBaseState({ mode: 'parent' }), actions), root);
    expect(document.querySelector('.soundboard-grid-parent').hasAttribute('data-gap')).toBe(false);
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

    const gapSelect = document.getElementById('pad-gap-select');
    expect([...gapSelect.options].map((o) => o.value)).toEqual(['compact', 'comfortable', 'wide', 'extra-wide']);
    gapSelect.value = 'wide';
    gapSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(actions.onChangeGap).toHaveBeenCalledWith('wide');

    [...document.querySelectorAll('.toolbar-btn')].find((b) => b.textContent.includes('Pet-proof')).click();
    expect(actions.onOpenPetProof).toHaveBeenCalledTimes(1);
  });
});
