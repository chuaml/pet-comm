import { describe, expect, it } from 'vitest';
import { autoColorBoardButtons, pickSmartColorForSlot } from '../src/utils/autoColor.js';
import {
  computeAutoForegroundHex,
  contrastRatio,
  hexToRgb,
  normalizeCustomColor,
  PET_COLORS,
  resolveButtonColors,
  rgbToHex,
} from '../src/utils/colors.js';
import { createDefaultButtons } from '../src/utils/defaults.js';
import { BUTTON_TYPE_PRESETS } from '../src/utils/presets.js';

describe('palette, custom full RGB & neighbor-aware auto-coloring', () => {
  it('ensures all 18 pre-made PET_COLORS meet WCAG AA 4.5:1 contrast and 14 presets use unique colors', () => {
    expect(PET_COLORS).toHaveLength(18);
    for (const preset of PET_COLORS) {
      const ratio = contrastRatio(hexToRgb(preset.bg), hexToRgb(preset.fg));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }

    const presetColorIds = BUTTON_TYPE_PRESETS.map((p) => p.colorId);
    expect(new Set(presetColorIds).size).toBe(BUTTON_TYPE_PRESETS.length);
  });

  it('normalizes hex/rgb and computes auto or custom foregrounds with >= 4.5:1 contrast', () => {
    expect(rgbToHex({ r: 42, g: 168, b: 152 })).toBe('#2AA898');
    expect(hexToRgb('#2aa898')).toEqual({ r: 42, g: 168, b: 152 });
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });

    for (const sample of [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
      { r: 128, g: 128, b: 128 },
      { r: 42, g: 168, b: 152 },
      { r: 220, g: 45, b: 95 },
    ]) {
      const autoFg = computeAutoForegroundHex(sample);
      expect(contrastRatio(sample, hexToRgb(autoFg))).toBeGreaterThanOrEqual(4.5);
    }

    const autoBtn = {
      colorId: 'royal-blue',
      customColor: normalizeCustomColor({ bgHex: '#FDE047', fgMode: 'auto' }),
    };
    const resolvedAuto = resolveButtonColors(autoBtn);
    expect(resolvedAuto.isCustom).toBe(true);
    expect(resolvedAuto.bg).toBe('#FDE047');
    expect(resolvedAuto.fg).toBe('#0B1F3A');

    const customFgBtn = {
      colorId: 'royal-blue',
      customColor: normalizeCustomColor({ bgHex: '#1E1B4B', fgMode: 'custom', fgHex: '#FDE68A' }),
    };
    expect(resolveButtonColors(customFgBtn).fg).toBe('#FDE68A');
  });

  it('avoids neighbor clashes and preserves custom RGB buttons during board Auto-Color', () => {
    const neighborBoard = [
      { id: 'n0', slotIndex: 0, colorId: 'royal-blue', customColor: null },
      { id: 'n1', slotIndex: 1, colorId: 'bright-yellow', customColor: null },
      { id: 'n4', slotIndex: 4, colorId: 'emerald-green', customColor: null },
    ];

    const chosen = pickSmartColorForSlot(neighborBoard, 5, 16);
    expect(['royal-blue', 'bright-yellow', 'emerald-green']).not.toContain(chosen);

    const starter = createDefaultButtons(1000);
    starter[0].customColor = { bgHex: '#2AA898', fgMode: 'custom', fgHex: '#FFFFFF' };

    const recolored = autoColorBoardButtons(starter, 16, 0.42);
    expect(recolored[0].customColor).toEqual(starter[0].customColor);

    const nonCustomColors = recolored.slice(1).map((b) => b.colorId);
    expect(new Set(nonCustomColors).size).toBe(nonCustomColors.length);
  });
});
