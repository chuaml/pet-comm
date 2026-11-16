---
name: pet-comm-visual-verify
description: >-
  Runs zero-dependency headless Chromium UI and layout verification (desktop + 390x844 mobile
  Pet Mode, 3-second hold-unlock into Parent Mode, Auto-Color, Voice Tune, and Custom RGB editor
  modals) against a Vite production build without adding packages to package.json. Use whenever
  modifying src/ui/, src/style.css, src/styles/, grid densities, colors, icons, or modal dialogs.
---

# Pet Comm Visual & DOM Verification

While `npm test` (`vitest` + `happy-dom` + `fake-indexeddb`) verifies unit logic, IndexedDB transactions, and `lit-html` DOM events, `happy-dom` does not compute CSS Grid / Container Query pixel layout. Run this headless Chromium workflow whenever modifying CSS layout, responsive grid densities, or modal aesthetics.

## Steps

1. Build the production bundle first:
   ```bash
   npm run build
   ```
2. Run the bundled headless verification script (pass `--out-dir` to save screenshots into your active artifact or scratch directory):
   ```bash
   npx -y -p playwright@latest sh -c 'PW_ROOT="$(dirname "$(which playwright)")/../lib/node_modules" node .agents/skills/pet-comm-visual-verify/scripts/verify-ui.mjs --out-dir /tmp/pet-comm-verify'
   ```
3. Inspect the generated screenshots (`pet-mode-desktop.png`, `pet-mode-mobile.png`, `parent-mode-20.png`, `voice-pack-loading-progress.png`, `voice-modal.png`, `parent-voice-pack-ready.png`, `editor-custom-rgb-modal.png`) with `read_file` and verify:
   - Single-word button labels (`Outside`, `Frisbee`, etc.) stay on a single line on `390x844` mobile portrait.
   - Parent Mode `.parent-slot` action buttons (`Test`, `Move`, `Edit`) fit cleanly inside card bounds at 16 and 20 slots.
   - Sticky `.dialog-footer` bars sit flush with the bottom of `<dialog>` with zero scrolled content bleeding underneath.
   - Zero `pageerror` or uncaught console errors occurred.

## Key Implementation Pitfalls Avoided by `scripts/verify-ui.mjs`
- **ESM resolution outside `node_modules`**: Uses `createRequire(path.join(process.env.PW_ROOT, 'index.js'))('playwright')` because Node ESM `import` ignores `NODE_PATH`.
- **Cached Chromium discovery**: Automatically locates `~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome` and passes `executablePath` when `playwright@latest` expects a newer browser build revision.
- **Pet Comm unlock gesture**: Dispatches `pointerdown` on `.corner-lock-btn` (not `click`) and holds for `3200ms` to enter Parent Mode.
- **Localhost `<progress>` bar capture**: Throttles `**/voice-pack/*.mp3` by `35ms` via `page.route()` so background download progress (`<progress class="task-progress-bar">`) is deterministically visible and screenshotted before localhost fetches complete.
