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
    await unlockBtn.dispatchEvent('pointerdown', { button: 0 });
  }
  await page.waitForTimeout(150);

  assert.equal(await page.locator('.pet-pad').count(), 14);
  assert.equal(await page.locator('.pet-pad-spacer').count(), 2);
  await page.screenshot({ path: path.join(outDir, 'pet-mode-desktop.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(outDir, 'pet-mode-mobile.png') });

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.locator('.corner-lock-btn').dispatchEvent('pointerdown', { pointerId: 1, button: 0 });
  await page.waitForTimeout(3200);
  await page.waitForSelector('.parent-toolbar');

  await page.locator('.density-chip', { hasText: '20' }).click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.parent-slot').count(), 20);
  await page.getByRole('button', { name: /Auto-Color/i }).click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(outDir, 'parent-mode-20.png') });

  await page.getByRole('button', { name: /Voice Tune/i }).click();
  await page.waitForSelector('#voice-dialog[open]');
  await page.screenshot({ path: path.join(outDir, 'voice-modal.png') });
  await page.locator('#voice-dialog').getByRole('button', { name: 'Done' }).click();

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
