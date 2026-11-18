# AGENTS.md — Pet Comm PWA Specification & AI Agent Guidelines

## 1. Project Overview
**App Name:** Pet Comm  
**Description:** A high-performance, offline-first Progressive Web App (PWA) soundboard designed for pets (dogs, cats) to communicate with their owners by pressing large, customizable on-screen buttons with their paws or noses.  
**Target Platform:** Mobile & Tablet Web Browsers (iOS/Android installed as a fullscreen PWA) and Desktop Browsers, deployed on **Cloudflare Pages**.

---

## 2. Strict Tech Stack & Architecture Constraints
AI Agents **MUST** adhere strictly to the following technical constraints:

*   **Core Technologies:** Vanilla HTML5, Modern CSS3 (CSS Grid, Flexbox, Custom Properties, Container Queries, Native `<dialog>`), ES6+ Modules, and **`lit-html` v3.3.3** (pure functional Light DOM templates, no heavy component framework).
*   **NO Bloated Frameworks:** **Strictly NO** React, Vue, Angular, Svelte, Solid, jQuery, or CSS frameworks like Tailwind/Bootstrap.
*   **Build Tool:** **Vite** (`dist/` static output).
*   **PWA Integration:** Custom Vanilla Service Worker (`public/sw.js` with Vite build-time precache manifest injection) and `public/manifest.webmanifest`.
    *   Exclude optional on-demand asset packs (such as `voice-pack/`) from `injectServiceWorkerManifest()` in `vite.config.js` so `0` extra bytes download until explicitly requested by the user.
*   **Audio Processing & Playback:**
    *   **Web Audio API** (`AudioContext`) for near-zero-latency `AudioBuffer` playback on `pointerdown`, with a `100ms` split-paw multi-touch guard, monophonic cutover, and configurable per-button cooldown (default `500ms`).
    *   **MediaStream Recording API** (`MediaRecorder`) with dynamic MIME negotiation, automatic leading/trailing silence trimming, and `24kHz` 16-bit mono PCM WAV encoding for instant start and universal Chrome/Safari `.json` backup compatibility.
    *   **Web Speech API & Optional Cached Human Voice Pack:** Default to OS offline `window.speechSynthesis` (`src/audio/ttsVoice.js` — prioritize `localService: true` offline OS voices over cloud voices, penalize novelty voices on `voice.name` only and never `.compact.` in `voiceURI`, avoid idle `speechSynthesis.cancel()` races, hold a module reference to `activeUtterance` against GC, and **never** emit synthetic oscillator tones when speech is unavailable). Pair with a **manually triggered**, IndexedDB-cached **Pre-Generated Human Voice Pack** (`public/voice-pack/`, `scripts/generate-voice-pack.mjs` — append trailing `.` + retry/skip-existing to avoid `edge-tts` `NoAudioReceived` on short words, and keep synced whenever `BUTTON_TYPE_PRESETS` changes), **Soft & Warm** defaults (`pitch: 1.2`, `rate: 0.92`, `volume: 0.8`), and phonetic TTS phrases (`OK` -> `"Okay"`).
*   **Local Storage / Persistence:** **IndexedDB** (`src/storage/db.js`, `DB_VERSION = 2` including `voicePack` store in `src/storage/voicePackStore.js`) for buttons, custom audio `Blob`s, cached voice pack clips, settings, and press activity logs (rolling 5,000-entry cap).
*   **Hosting & Deployment:** **Cloudflare Pages** (`npm run build`, output `dist/`, Node `26.13.0`, `public/_headers`).

---

## 3. Operational Rules

1.  **Dependency & Test Discipline:** Keep `"lit-html": "3.3.3"` as the sole runtime dependency, and keep `devDependencies` strictly limited to `"vite"` and the Vitest stack (`"vitest"`, `"happy-dom"`, `"fake-indexeddb"`, `"@vitest/coverage-v8"`, `pool: 'vmThreads'`). In DOM tests, always render `lit-html` templates into `#test-root` (never directly into `document.body`, which corrupts `lit-html` `_$litPart$` markers on cleanup) and isolate state via per-test `new IDBFactory()` + `resetStorageForTests()` + `resetVoicePackLoaderForTests()` without calling `db.close()` on in-flight transactions.
2.  **Touch, Gesture Activation & Synchronous Audio:** Bind pet soundboard buttons strictly to `pointerdown` (never `click`), relying on CSS `touch-action: manipulation;` and `user-select: none; -webkit-user-select: none;` rather than `e.preventDefault()` on `.pet-pad` `pointerdown` so mobile/Safari transient user activation is preserved. Always call `speechSynthesis.speak()` and `AudioContext.resume()` synchronously inside the user gesture before any `await`.
3.  **Spatial Consistency & Dense Grid Sizing:** Grid densities (`4`, `9`, `12`, `16`, `20`, default `16`) maintain fixed spatial slots so pets' muscle memory is preserved; unused slots remain inert in Pet Mode and overflow buttons stay parked in Parent Mode. Size `.pad-label` using inline container units (`cqi`/`cqb` rather than `cqmin` alone) so single-word labels never wrap mid-word on narrow mobile portrait screens, and use `minmax(...)` auto-rows in `.soundboard-grid-parent` so Parent Mode slot actions never overflow across rows.
4.  **Color System & Smart Auto-Coloring:** Resolve pad colors via `resolveButtonColors(btn)` (`src/utils/colors.js`), supporting both the 18 WCAG AA+ (`>= 4.5:1`) pre-made swatches and `btn.customColor` Full RGB (`computeAutoForegroundHex` must fall back to `#000000`/`#FFFFFF` whenever `#0B1F3A` contrast `< 5.0:1`). Assign automatic colors via 2D neighbor-aware `src/utils/autoColor.js` (never simple modulo cycling), and always keep manual `customColor` buttons untouched during board-wide **Auto-Color**.
5.  **Background Asset Loading & Paw-Safe UI:** Trigger optional asset downloads (`voicePackLoader.js`) **only on explicit user action**, keep active audio running uninterrupted while downloading, **gate switching** until caching is 100% complete (falling back to `'os'` if saved settings reference an uncached pack), and render `<progress>` / `"Ready to switch"` status banners (`src/state/loadingStatus.js`) in Parent Mode and modals only so locked Pet Mode stays clutter-free and paw-safe.
6.  **Defensive Web APIs & Zero-Voice OS Check:** Feature-detect `AudioContext`, `MediaRecorder`, `navigator.wakeLock`, `indexedDB`, `speechSynthesis`, and `serviceWorker` before calling. Never assume `'speechSynthesis' in window` means OS voices exist — on Linux without `speech-dispatcher`, `'speechSynthesis' in window` is `true` while `getVoices()` is `[]`; check `hasSystemVoices()` (`getVoices().length > 0`) instead.
7.  **File Size Limit:** Keep every source file strictly under **250 lines of code**, splitting responsibilities cleanly across modules.
8.  **Docs Ship With Tooling & Enforce Over Instruct:** Any change to `package.json` scripts, `vite.config.js`, test setup, or build/deploy tooling must update `AGENTS.md` and `README.md` in the same change, without waiting to be asked. When a guardrail exists to stop an agent or tool from doing something harmful (hanging, noisy output, wrong command), enforce it in config or code rather than only documenting it, then prove it by running the failure case and each variant and reporting the exit codes.

---

## 4. Running Tests Efficiently (Agents)

The Vitest config (`vite.config.js`) auto-detects agent runs (`ANTIGRAVITY_AGENT`, `GEMINI_CLI`, `CLAUDECODE`, `CURSOR_AGENT`, `CODEX_SANDBOX`, or `AI_AGENT=1`) and switches to the failures-only `agent` reporter with `silent: 'passed-only'`. A green run prints only the summary; a red run prints only the failing tests with diff, code frame, and their own console output. Do **not** pipe through `tail`/`grep` or add `--reporter=verbose` — the output is already minimal and truncating it can hide failures.

| Goal | Command |
| :--- | :--- |
| Full suite (~6s, run before finishing any change) | `npm test` |
| Force agent output when no agent env var is detected | `npm run test:agent` |
| One file while iterating | `npx vitest run tests/colors.test.js` |
| One test by name | `npx vitest run tests/colors.test.js -t "name substring"` |
| Only tests affected by given source files (ran all 9 files for `src/utils/colors.js` when tried; prefer a single test file) | `npx vitest related --run src/utils/colors.js` |
| Only tests affected by uncommitted changes (ran all files while `vite.config.js` was modified) | `npx vitest run --changed` |
| Coverage (compact table of not-fully-covered files + summary, no HTML) | `npm run test:coverage` |

1.  **Always use one-shot runs:** Watch mode never exits and hangs the agent's command. As a safety net, detected agent runs force `watch: false` (bare `vitest` and `npm run test:watch` run once and exit) and an explicit `--watch`/`-w`/`vitest watch`/`vitest dev` fails immediately with exit code `1`. Do not rely on the net — if your agent env var is not in `AGENT_ENV_KEYS` (`vite.config.js`) there is no protection, so always use `npm test` or `npx vitest run ...`, or prefix with `AI_AGENT=1`.
2.  **Iterate narrow, finish wide:** Run the single affected test file while editing (about 2s versus about 6s for the suite; `related`/`--changed` may not narrow anything), then one full `npm test` before reporting the work as done. Trust the exit code (`0` = pass, `1` = failure).
3.  **Keep output quiet:** Do not leave `console.log` in tests or source. When a new, expected third-party warning appears, filter it in `onConsoleLog` in `vite.config.js` instead of ignoring the noise.
4.  **UI/CSS changes need more than Vitest:** After touching `src/ui/`, `src/style.css`, or `src/styles/`, also run the `pet-comm-visual-verify` skill (`.agents/skills/pet-comm-visual-verify/SKILL.md`).
5.  **Probe possibly-hanging commands safely:** When running anything that may not exit (watch modes, dev servers, interactive CLIs), wrap it as `timeout -k 2 <seconds> <command> </dev/null` (or `timeout -s KILL`). A plain `timeout <seconds> npx vitest` did not stop watch mode. Run one such command per tool call so a hang cannot block the checks queued behind it, and confirm afterwards with `ps` that no process was left running.
