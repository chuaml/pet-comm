import { html, render } from 'lit-html';
import { describe, expect, it, vi } from 'vitest';
import { editorDialogView } from '../src/ui/editor.js';
import { createEditorActions } from '../src/ui/editorController.js';
import { createVoiceActions } from '../src/ui/voiceController.js';
import { voiceDialogView } from '../src/ui/voiceModal.js';
import { createDefaultButtons, DEFAULT_SETTINGS } from '../src/utils/defaults.js';

function createReactiveHarness() {
  const state = {
    settings: { ...DEFAULT_SETTINGS },
    buttons: createDefaultButtons(1000),
    audioMap: new Map(),
    availableVoices: [
      { name: 'Samantha (Enhanced)', voiceURI: 'samantha-enh', lang: 'en-US', localService: true },
    ],
    editorDraft: null,
    voiceModalOpen: false,
  };

  let actions = {};
  const setState = (patch) => {
    Object.assign(state, patch);
    render(
      html`${editorDialogView(state, actions)} ${voiceDialogView(state, actions)}`,
      document.getElementById('test-root')
    );
  };

  actions = {
    ...createEditorActions(state, setState),
    ...createVoiceActions(state, setState),
  };
  setState({});
  return { state, actions };
}

describe('Voice Tune & Button Editor (Presets + Custom Full RGB) modal views', () => {
  it('updates Voice Tune presets, syncs range slider --control-value, and previews speech', async () => {
    const spoken = [];
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => [
          { name: 'Samantha (Enhanced)', voiceURI: 'samantha-enh', lang: 'en-US', localService: true },
        ],
        cancel: vi.fn(),
        speak: (u) => spoken.push(u),
      },
      configurable: true,
    });

    const { state, actions } = createReactiveHarness();
    actions.onOpenVoiceModal();
    expect(state.voiceModalOpen).toBe(true);

    const cheerfulBtn = [...document.querySelectorAll('.voice-preset-btn')].find((b) =>
      b.textContent.includes('Cheerful')
    );
    cheerfulBtn.click();
    await Promise.resolve();
    expect(state.settings.ttsPitch).toBe(1.35);
    expect(spoken.at(-1)?.text).toBe('Play');

    const pitchSlider = document.querySelector('#voice-pitch-range');
    pitchSlider.value = '1.45';
    pitchSlider.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 15));
    expect(pitchSlider.style.getPropertyValue('--control-value')).toBe('1.45');
    expect(state.settings.ttsPitch).toBe(1.45);
  });

  it('auto-fills Button Type presets, configures Custom Full RGB + Custom Text RGB, and saves button', async () => {
    const { state, actions } = createReactiveHarness();

    // Open create modal for empty slot 14 -> smart auto-color picks unused color
    actions.onOpenCreateModal(14);
    expect(state.editorDraft?.isNew).toBe(true);
    const existingColors = new Set(state.buttons.map((b) => b.colorId));
    expect(existingColors.has(state.editorDraft.colorId)).toBe(false);

    // Tap "OK" preset chip -> auto-fills label "OK" and natural TTS "Okay"
    const okChip = [...document.querySelectorAll('.preset-type-chip')].find(
      (b) => b.textContent.trim() === 'OK'
    );
    okChip.click();
    expect(state.editorDraft.label).toBe('OK');
    expect(state.editorDraft.ttsText).toBe('Okay');
    expect(state.editorDraft.colorId).toBe('emerald-green');

    // Switch to Custom Full RGB and set R=42, G=168, B=152 (#2AA898)
    document.querySelector('.custom-rgb-trigger').click();
    expect(state.editorDraft.customColor).not.toBeNull();

    for (const [sel, val] of [
      ['#bg-rgb-r', '42'],
      ['#bg-rgb-g', '168'],
      ['#bg-rgb-b', '152'],
    ]) {
      const slider = document.querySelector(sel);
      slider.value = val;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(state.editorDraft.customColor.bgHex).toBe('#2AA898');

    // Enable Custom Text RGB override and set custom hex
    const customFgPill = [...document.querySelectorAll('.rgb-mode-pill')].find((b) =>
      b.textContent.includes('Custom Text RGB')
    );
    customFgPill.click();
    const fgHexInput = document.querySelector('#fg-rgb-hex');
    fgHexInput.value = '#FFFBEB';
    fgHexInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(state.editorDraft.customColor).toEqual({
      bgHex: '#2AA898',
      fgMode: 'custom',
      fgHex: '#FFFBEB',
    });

    // Save button via form submit
    document.querySelector('.editor-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 15));

    expect(state.editorDraft).toBeNull();
    expect(state.buttons).toHaveLength(15);
    const saved = state.buttons.find((b) => b.slotIndex === 14);
    expect(saved?.label).toBe('OK');
    expect(saved?.customColor).toEqual({
      bgHex: '#2AA898',
      fgMode: 'custom',
      fgHex: '#FFFBEB',
    });
  });
});
