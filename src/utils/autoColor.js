import { hexToRgb, normalizeCustomColor, PET_COLORS, resolveButtonColors } from './colors.js';

function getColumnLayouts(density) {
  if (density === 4) return [2];
  if (density === 9) return [3];
  if (density === 12) return [3, 4];
  if (density === 20) return [4, 5];
  return [4];
}

function getNeighborType(slotA, slotB, density) {
  if (!Number.isInteger(slotA) || !Number.isInteger(slotB) || slotA === slotB) return 'none';
  if (slotA < 0 || slotB < 0 || slotA >= density || slotB >= density) return 'none';

  let best = 'none';
  for (const cols of getColumnLayouts(density)) {
    const rA = Math.floor(slotA / cols);
    const cA = slotA % cols;
    const rB = Math.floor(slotB / cols);
    const cB = slotB % cols;
    const dr = Math.abs(rA - rB);
    const dc = Math.abs(cA - cB);
    if (dr + dc === 1) return 'orthogonal';
    if (dr === 1 && dc === 1) best = 'diagonal';
  }
  return best;
}

export function perceptualColorDistance(rgbA, rgbB) {
  if (!rgbA || !rgbB) return 0;
  const rMean = (rgbA.r + rgbB.r) / 2;
  const dr = rgbA.r - rgbB.r;
  const dg = rgbA.g - rgbB.g;
  const db = rgbA.b - rgbB.b;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

export function pickSmartColorForSlot(
  buttons,
  slotIndex,
  density = 16,
  { paletteOrder = PET_COLORS, avoidColorId = null } = {}
) {
  const others = (buttons || []).filter((b) => b && b.slotIndex !== slotIndex);
  const usageCounts = new Map();
  const neighborRgbs = [];

  for (const btn of others) {
    if (!normalizeCustomColor(btn.customColor) && btn.colorId) {
      usageCounts.set(btn.colorId, (usageCounts.get(btn.colorId) || 0) + 1);
    }
    const rel = getNeighborType(slotIndex, btn.slotIndex, density);
    if (rel !== 'none') {
      const resolved = resolveButtonColors(btn);
      neighborRgbs.push({
        rel,
        colorId: resolved.isCustom ? null : resolved.id,
        rgb: hexToRgb(resolved.bg),
      });
    }
  }

  let bestId = paletteOrder[0]?.id || PET_COLORS[0].id;
  let bestScore = -Infinity;

  for (let idx = 0; idx < paletteOrder.length; idx += 1) {
    const candidate = paletteOrder[idx];
    const candRgb = hexToRgb(candidate.bg);
    const used = usageCounts.get(candidate.id) || 0;
    let score = -used * 220 - idx * 1.5;

    if (avoidColorId && candidate.id === avoidColorId) {
      score -= 110;
    }

    let minNeighborDist = 765;
    for (const nb of neighborRgbs) {
      const dist = perceptualColorDistance(candRgb, nb.rgb);
      if (dist < minNeighborDist) minNeighborDist = dist;

      if (nb.colorId === candidate.id) {
        score -= nb.rel === 'orthogonal' ? 1800 : 600;
      } else if (dist < 140) {
        score -= nb.rel === 'orthogonal' ? (140 - dist) * 4 : (140 - dist) * 1.6;
      }
    }

    if (neighborRgbs.length > 0) {
      score += minNeighborDist * 0.75;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = candidate.id;
    }
  }

  return bestId;
}

function createSeededPalette(seed = Math.random()) {
  const copy = [...PET_COLORS];
  let state = Math.floor(Math.abs(Number(seed) || 0.5) * 2147483646) + 1;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    state = (state * 48271) % 2147483647;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function autoColorBoardButtons(buttons, density = 16, seed = Math.random()) {
  if (!Array.isArray(buttons) || buttons.length === 0) return [];
  const paletteOrder = createSeededPalette(seed);
  const now = Date.now();

  const locked = buttons.filter((b) => Boolean(normalizeCustomColor(b.customColor)));
  const targets = buttons
    .filter((b) => !normalizeCustomColor(b.customColor))
    .sort((a, b) => a.slotIndex - b.slotIndex || a.id.localeCompare(b.id));

  const assignedById = new Map();
  const workingBoard = [...locked];

  for (const btn of targets) {
    const nextColorId = pickSmartColorForSlot(workingBoard, btn.slotIndex, density, {
      paletteOrder,
      avoidColorId: btn.colorId,
    });
    const updatedBtn = { ...btn, colorId: nextColorId, customColor: null, updatedAt: now };
    assignedById.set(btn.id, updatedBtn);
    workingBoard.push(updatedBtn);
  }

  return buttons.map((btn) => assignedById.get(btn.id) || btn);
}
