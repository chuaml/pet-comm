import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(path.join(process.env.PW_ROOT, 'index.js'));
const { chromium } = require('playwright');

const outFlagIdx = process.argv.indexOf('--out-dir');
const outDir =
  outFlagIdx !== -1 && process.argv[outFlagIdx + 1]
    ? path.resolve(process.argv[outFlagIdx + 1])
    : path.resolve('/tmp/pet-comm-verify');
fs.mkdirSync(outDir, { recursive: true });

function findCachedChromium() {
  const cacheDir = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(cacheDir)) return undefined;
  const dirs = fs
    .readdirSync(cacheDir)
    .filter((d) => d.startsWith('chromium-'))
    .sort()
    .reverse();
  for (const dir of dirs) {
    const candidate = path.join(cacheDir, dir, 'chrome-linux64', 'chrome');
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

const PORT = 4183;
const URL = `http://127.0.0.1:${PORT}`;

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
      { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Preview server timeout: ${output}`)), 8000);
    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes(String(PORT))) {
        clearTimeout(timer);
        resolve(proc);
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Parent lock gesture: hold ~0.6s to arm the track, slide left to its end, release there.
async function unlockParentMode(page, shots = null) {
  const lock = page.locator('.corner-lock-btn');
  const at = (clientX) => ({ pointerId: 1, button: 0, clientX, clientY: 30 });
  await lock.dispatchEvent('pointerdown', at(600));
  await page.waitForSelector('.corner-lock-zone[data-phase="holding"]');
  if (shots) await page.screenshot({ path: path.join(shots, 'lock-holding.png') });
  await page.waitForSelector('.corner-lock-zone[data-phase="armed"]', { timeout: 2000 });
  await lock.dispatchEvent('pointermove', at(480));
  if (shots) await page.screenshot({ path: path.join(shots, 'lock-armed.png') });
  await lock.dispatchEvent('pointermove', at(100));
  await lock.dispatchEvent('pointerup', at(100));
  await page.waitForSelector('.parent-toolbar');
}

// Pet Mode geometry: grid gap in px, plus whether the lock or any pad overlaps another pad.
function measurePetLayout(page) {
  return page.evaluate(() => {
    const rect = (el) => el.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const pads = [...document.querySelectorAll('.pet-pad')].map(rect);
    const lock = rect(document.querySelector('.corner-lock-btn'));
    return {
      gap: parseFloat(getComputedStyle(document.querySelector('.soundboard-grid')).columnGap),
      lockOverlaps: pads.filter((p) => hit(p, lock)).length,
      padOverlaps: pads.filter((p, i) => pads.some((q, j) => i < j && hit(p, q))).length,
      wrappedLabels: [...document.querySelectorAll('.pad-label')].filter(
        (l) => !l.textContent.trim().includes(' ') && rect(l).height > parseFloat(getComputedStyle(l).lineHeight) * 1.5
      ).length,
      touchAction: getComputedStyle(document.querySelector('.pet-pad')).touchAction,
    };
  });
}

const server = await startPreviewServer();
let browser;

try {
  const executablePath = findCachedChromium();
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });

  const unlockBtn = page.locator('.audio-unlock-btn');
  if (await unlockBtn.isVisible()) {
    await unlockBtn.click();
  }
  await page.waitForTimeout(150);

  assert.equal(await page.locator('.pet-pad').count(), 14);
  assert.equal(await page.locator('.pet-pad-spacer').count(), 2);
  await page.screenshot({ path: path.join(outDir, 'pet-mode-desktop.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(outDir, 'pet-mode-mobile.png') });

  // Tap and hold-without-slide must not unlock; the lock must never sit on a pad.
  const lockBtn = page.locator('.corner-lock-btn');
  await lockBtn.dispatchEvent('pointerdown', { pointerId: 1, button: 0, clientX: 600, clientY: 30 });
  await page.waitForTimeout(1500);
  await lockBtn.dispatchEvent('pointerup', { pointerId: 1, button: 0, clientX: 600, clientY: 30 });
  assert.equal(await page.locator('.parent-toolbar').count(), 0, 'Hold without slide must not unlock');
  const mobileLayout = await measurePetLayout(page);
  assert.equal(mobileLayout.lockOverlaps, 0, 'Lock must not overlap a pad');
  assert.equal(mobileLayout.touchAction, 'none', 'Pet pads must disable pinch zoom');

  await page.setViewportSize({ width: 1180, height: 820 });
  await unlockParentMode(page, outDir);

  // Button Gap: each step widens the gap at every density without overlap or mid-word wrapping.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const density of ['4', '16', '20']) {
    await page.locator('.density-chip', { hasText: new RegExp(`^${density}$`) }).click();
    let previousGap = 0;
    for (const gapId of ['compact', 'comfortable', 'wide', 'extra-wide']) {
      await page.locator('#pad-gap-select').selectOption(gapId);
      await page.getByRole('button', { name: /Lock \(Pet Mode\)/i }).click();
      await page.waitForSelector(`.soundboard-grid[data-gap="${gapId}"]`);
      const layout = await measurePetLayout(page);
      assert.ok(layout.gap > previousGap, `Gap ${gapId}@${density} (${layout.gap}px) must exceed ${previousGap}px`);
      assert.deepEqual(
        [layout.lockOverlaps, layout.padOverlaps, layout.wrappedLabels], [0, 0, 0],
        `Layout broken at ${gapId}@${density}: ${JSON.stringify(layout)}`
      );
      previousGap = layout.gap;
      await page.screenshot({ path: path.join(outDir, `gap-${gapId}-${density}-mobile.png`) });
      await unlockParentMode(page);
    }
  }
  await page.locator('#pad-gap-select').selectOption('comfortable');
  await page.getByRole('button', { name: /Pet-proof/i }).click();
  await page.waitForSelector('#petproof-dialog[open]');
  await page.screenshot({ path: path.join(outDir, 'petproof-dialog-mobile.png') });
  await page.locator('#petproof-dialog').getByRole('button', { name: 'Done' }).click();
  await page.setViewportSize({ width: 1180, height: 820 });

  await page.locator('.density-chip', { hasText: '20' }).click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.parent-slot').count(), 20);
  await page.getByRole('button', { name: /Auto-Color/i }).click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(outDir, 'parent-mode-20.png') });

  await page.route('**/voice-pack/*.mp3', async (route) => {
    await new Promise((r) => setTimeout(r, 35));
    await route.continue();
  });
  await page.getByRole('button', { name: /Voice Tune/i }).click();
  await page.waitForSelector('#voice-dialog[open]');
  await page.locator('#voice-dialog').getByRole('button', { name: /Load Human Voice Pack/i }).click();
  await page.waitForSelector('#voice-dialog progress.task-progress-bar');
  await page.waitForTimeout(260);
  await page.screenshot({ path: path.join(outDir, 'voice-pack-loading-progress.png') });
  await page.waitForSelector('.voice-pack-ready-row', { timeout: 8000 });
  await page.screenshot({ path: path.join(outDir, 'voice-modal.png') });
  await page.locator('.speech-diag-summary').click();
  await page.locator('.speech-diag-actions').scrollIntoViewIfNeeded();
  assert.match(await page.locator('.speech-diag-report').inputValue(), /Pet Comm speech report/);
  await page.screenshot({ path: path.join(outDir, 'speech-diagnostics.png') });
  await page.locator('#voice-dialog').getByRole('button', { name: 'Done' }).click();
  await page.waitForSelector('.loading-status-banner[data-phase="ready"]');
  await page.screenshot({ path: path.join(outDir, 'parent-voice-pack-ready.png') });
  await page.locator('.loading-status-banner').getByRole('button', { name: /Switch to Human Voice/i }).click();

  // Attention cue: 5s idle reminder pulses the last pressed pad inside its own slot.
  await page.locator('#attention-cue-input').fill('5');
  await page.locator('#attention-cue-input').dispatchEvent('change');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(outDir, 'parent-toolbar-mobile.png') });
  await page.getByRole('button', { name: /Lock \(Pet Mode\)/i }).click();
  await page.locator('.pet-pad').nth(5).dispatchEvent('pointerdown', { button: 0 });
  assert.equal(await page.locator('.pet-pad[data-attention="true"]').count(), 0);
  await page.waitForSelector('.pet-pad[data-attention="true"]', { timeout: 8000 });
  // Capture near the peak of the 0.8s pulse; a fixed delay lands on the trough and shows no glow.
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.pet-pad[data-attention="true"]')).scale) > 1.045,
    null,
    { polling: 'raf', timeout: 2000 }
  );
  await page.screenshot({ path: path.join(outDir, 'attention-cue-mobile.png') });
  const overlap = await page.evaluate(() => {
    const pads = [...document.querySelectorAll('.pet-pad')];
    const cue = document.querySelector('.pet-pad[data-attention="true"]').getBoundingClientRect();
    return pads.filter((pad) => {
      if (pad.dataset.attention === 'true') return false;
      const r = pad.getBoundingClientRect();
      return r.left < cue.right && r.right > cue.left && r.top < cue.bottom && r.bottom > cue.top;
    }).length;
  });
  assert.equal(overlap, 0, 'Pulsing pad must stay inside its own grid slot');
  assert.equal(
    await page.locator('.pet-pad[data-attention="true"]').getAttribute('aria-label'),
    await page.locator('.pet-pad').nth(5).getAttribute('aria-label')
  );
  await page.waitForSelector('.pet-pad[data-attention="true"]', { state: 'detached', timeout: 4000 });
  await page.setViewportSize({ width: 1180, height: 820 });
  await unlockParentMode(page);
  await page.locator('#attention-cue-input').fill('0');
  await page.locator('#attention-cue-input').dispatchEvent('change');

  await page.locator('.parent-slot-empty').first().click();
  await page.waitForSelector('#editor-dialog[open]');
  await page.locator('.preset-type-chip', { hasText: 'Frisbee' }).click();
  await page.locator('.custom-rgb-trigger').click();
  await page.locator('#bg-rgb-r').fill('42');
  await page.locator('#bg-rgb-r').dispatchEvent('input');
  await page.locator('#bg-rgb-g').fill('168');
  await page.locator('#bg-rgb-g').dispatchEvent('input');
  await page.locator('#bg-rgb-b').fill('152');
  await page.locator('#bg-rgb-b').dispatchEvent('input');
  await page.screenshot({ path: path.join(outDir, 'editor-custom-rgb-modal.png') });

  assert.equal(consoleErrors.length, 0, `Page errors: ${consoleErrors.join('; ')}`);
  console.log(`Visual verification passed. Screenshots saved to ${outDir}`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
