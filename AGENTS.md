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
*   **Audio Processing & Playback:**
    *   **Web Audio API** (`AudioContext`) for near-zero-latency `AudioBuffer` playback on `pointerdown`, with a `100ms` split-paw multi-touch guard, monophonic cutover, and configurable per-button cooldown (default `500ms`).
    *   **MediaStream Recording API** (`MediaRecorder`) with dynamic MIME negotiation, automatic leading/trailing silence trimming, and `24kHz` 16-bit mono PCM WAV encoding for instant start and universal Chrome/Safari `.json` backup compatibility.
    *   **Web Speech API** (`window.speechSynthesis`) as an instant fallback for Text-to-Speech (TTS).
*   **Local Storage / Persistence:** **IndexedDB** (`src/storage/db.js`) for buttons, audio `Blob`s, settings, and press activity logs (rolling 5,000-entry cap).
*   **Hosting & Deployment:** **Cloudflare Pages** (`npm run build`, output `dist/`, Node `26.13.0`, `public/_headers`).

---

## 3. Operational Rules

1.  **Dependency Discipline:** Keep `"lit-html": "3.3.3"` as the sole runtime dependency and `"vite"` as the sole devDependency. Use Node's built-in `node:test` runner for automated tests and inline SVGs for icons.
2.  **Touch & Pointer Precision:** Bind pet soundboard buttons strictly to `pointerdown` (never `click`), with `touch-action: manipulation;` and `user-select: none; -webkit-user-select: none;`.
3.  **Spatial Consistency:** Grid densities (`1`, `2`, `4`, `6`, `9`) maintain fixed spatial slots so pets' muscle memory is preserved; unused slots remain inert in Pet Mode and overflow buttons stay parked in Parent Mode.
4.  **Defensive Web APIs:** Feature-detect `AudioContext`, `MediaRecorder`, `navigator.wakeLock`, `indexedDB`, `speechSynthesis`, and `serviceWorker` before calling.
5.  **File Size Limit:** Keep every source file strictly under **250 lines of code**, splitting responsibilities cleanly across modules.
