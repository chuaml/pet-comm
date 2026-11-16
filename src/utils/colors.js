export const PET_COLORS = Object.freeze([
  { id: 'royal-blue', name: 'Royal Blue', bg: '#0057B8', fg: '#FFFFFF', border: '#93C5FD', ring: '#FFD600' },
  { id: 'bright-yellow', name: 'Sunny Yellow', bg: '#FFD600', fg: '#0B1F3A', border: '#0B1F3A', ring: '#0057B8' },
  { id: 'emerald-green', name: 'Emerald', bg: '#047857', fg: '#FFFFFF', border: '#6EE7B7', ring: '#FFD600' },
  { id: 'coral-red', name: 'Coral Red', bg: '#DC2626', fg: '#FFFFFF', border: '#FECACA', ring: '#FFD600' },
  { id: 'sky-cyan', name: 'Sky Blue', bg: '#0369A1', fg: '#FFFFFF', border: '#7DD3FC', ring: '#FFD600' },
  { id: 'warm-amber', name: 'Warm Amber', bg: '#F59E0B', fg: '#0B1F3A', border: '#0B1F3A', ring: '#FFFFFF' },
  { id: 'vivid-purple', name: 'Purple', bg: '#7C3AED', fg: '#FFFFFF', border: '#DDD6FE', ring: '#FFD600' },
  { id: 'teal-mint', name: 'Teal', bg: '#0F766E', fg: '#FFFFFF', border: '#5EEAD4', ring: '#FFD600' },
  { id: 'tangerine', name: 'Tangerine', bg: '#FB923C', fg: '#0B1F3A', border: '#431407', ring: '#FFFFFF' },
  { id: 'indigo-night', name: 'Indigo', bg: '#4338CA', fg: '#FFFFFF', border: '#A5B4FC', ring: '#FFD600' },
  { id: 'fresh-lime', name: 'Fresh Lime', bg: '#84CC16', fg: '#0B1F3A', border: '#1A2E05', ring: '#FFFFFF' },
  { id: 'rose-berry', name: 'Berry Pink', bg: '#BE185D', fg: '#FFFFFF', border: '#FBCFE8', ring: '#FFD600' },
  { id: 'aqua-ice', name: 'Aqua', bg: '#22D3EE', fg: '#0B1F3A', border: '#083344', ring: '#FFD600' },
  { id: 'apricot-peach', name: 'Apricot', bg: '#FDBA74', fg: '#0B1F3A', border: '#431407', ring: '#0057B8' },
  { id: 'soft-lavender', name: 'Lavender', bg: '#C4B5FD', fg: '#1E1B4B', border: '#312E81', ring: '#FFD600' },
  { id: 'dark-navy', name: 'Deep Navy', bg: '#0B1F3A', fg: '#FFD600', border: '#60A5FA', ring: '#FFD600' },
  { id: 'light-gray', name: 'Cool Mist', bg: '#CBD5E1', fg: '#0B1F3A', border: '#334155', ring: '#0057B8' },
  { id: 'crisp-white', name: 'White', bg: '#FFFFFF', fg: '#0B1F3A', border: '#0057B8', ring: '#0057B8' },
]);

export function clampByte(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.min(255, Math.max(0, Math.round(num)));
}

export function rgbToHex({ r, g, b }) {
  const hex = [r, g, b].map((ch) => clampByte(ch).toString(16).padStart(2, '0')).join('');
  return `#${hex.toUpperCase()}`;
}

export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

export function relativeLuminance({ r, g, b }) {
  const toLinear = (ch) => {
    const s = clampByte(ch) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(rgbA, rgbB) {
  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

const NAVY_INK_RGB = Object.freeze({ r: 11, g: 31, b: 58 });
const BLACK_INK_RGB = Object.freeze({ r: 0, g: 0, b: 0 });
const LIGHT_INK_RGB = Object.freeze({ r: 255, g: 255, b: 255 });

export function computeAutoForegroundHex(bgRgb) {
  const navyContrast = contrastRatio(bgRgb, NAVY_INK_RGB);
  if (navyContrast >= 5.0) return '#0B1F3A';
  const blackContrast = contrastRatio(bgRgb, BLACK_INK_RGB);
  const whiteContrast = contrastRatio(bgRgb, LIGHT_INK_RGB);
  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
}

export function computeAutoBorderHex(bgRgb) {
  if (relativeLuminance(bgRgb) > 0.34) {
    return '#0B1F3A';
  }
  return rgbToHex({
    r: bgRgb.r + (255 - bgRgb.r) * 0.56,
    g: bgRgb.g + (255 - bgRgb.g) * 0.56,
    b: bgRgb.b + (255 - bgRgb.b) * 0.56,
  });
}

export function getColorPreset(colorId) {
  return PET_COLORS.find((c) => c.id === colorId) || PET_COLORS[0];
}

export function normalizeCustomColor(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const bgRgb = hexToRgb(raw.bgHex);
  if (!bgRgb) return null;
  const fgMode = raw.fgMode === 'custom' ? 'custom' : 'auto';
  const parsedFg = hexToRgb(raw.fgHex);
  const fgHex = parsedFg ? rgbToHex(parsedFg) : computeAutoForegroundHex(bgRgb);
  return {
    bgHex: rgbToHex(bgRgb),
    fgMode,
    fgHex,
  };
}

export function resolveButtonColors(btn) {
  const custom = normalizeCustomColor(btn?.customColor);
  if (custom) {
    const bgRgb = hexToRgb(custom.bgHex);
    const autoFg = computeAutoForegroundHex(bgRgb);
    const fg = custom.fgMode === 'custom' ? custom.fgHex : autoFg;
    const border = computeAutoBorderHex(bgRgb);
    const ring = relativeLuminance(bgRgb) > 0.45 ? '#0057B8' : '#FFD600';
    return {
      id: 'custom',
      name: 'Custom RGB',
      bg: custom.bgHex,
      fg,
      border,
      ring,
      isCustom: true,
    };
  }
  const preset = getColorPreset(btn?.colorId);
  return { ...preset, isCustom: false };
}
