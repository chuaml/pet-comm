# AGENTS.md — Pet Comm PWA Specification & AI Agent Guidelines

## 1. Project Overview
**App Name:** Pet Comm  
**Description:** A high-performance, offline-first Progressive Web App (PWA) soundboard designed for pets (dogs, cats) to communicate with their owners by pressing large, customizable on-screen buttons with their paws or noses.  
**Target Platform:** Mobile & Tablet Web Browsers (iOS/Android installed as a fullscreen PWA) and Desktop Browsers, deployed on **Cloudflare Pages**.

---

## 2. Strict Tech Stack & Architecture Constraints
AI Agents **MUST** adhere strictly to the following technical constraints. Do not deviate or introduce unauthorized dependencies.

*   **Core Technologies:** Vanilla HTML5, Modern CSS3 (CSS Grid, Flexbox, Custom Properties), and Vanilla JavaScript (ES6+ Modules).
*   **NO Frameworks:** **Strictly NO** React, Vue, Angular, Svelte, Solid, jQuery, or CSS frameworks like Tailwind/Bootstrap. Keep the bundle size near zero.
*   **Build Tool:** **Vite** (Vanilla JS template).
*   **PWA Integration:** `vite-plugin-pwa` (for Service Worker generation, offline caching, and `manifest.webmanifest`) OR a clean, custom Vanilla Service Worker (`sw.js`).
*   **Audio Processing & Playback:** 
    *   **Web Audio API** (`AudioContext`) for near-zero latency playback when a button is pressed.
    *   **MediaStream Recording API** (`MediaRecorder`) for owners to record custom voice clips directly in the browser.
    *   **Web Speech API** (`window.speechSynthesis`) as an instant fallback for Text-to-Speech (TTS) if custom audio is not recorded.
*   **Local Storage / Persistence:** **IndexedDB** (written cleanly via a lightweight custom wrapper or a tiny dependency-free helper) to store custom recorded audio `Blob`/`ArrayBuffer` data and button configurations locally on the device. *Do not use `localStorage` for audio data due to the 5MB limit.*
*   **Hosting & Deployment:** **Cloudflare Pages** (Static output in `dist/`).

---

## 3. Core Functional Requirements

### 3.1. Pet Mode vs. Parent (Edit) Mode
*   **Pet Mode (Default):**
    *   Fullscreen, distraction-free grid of large buttons.
    *   **Child/Pet Lock:** Accessing "Parent Mode" requires a deliberate human action (e.g., pressing and holding a small corner lock icon for 3 seconds, or solving a simple math prompt) so pets cannot accidentally delete buttons or trigger settings.
    *   **Multi-Touch & Debounce:** Pets often step on the screen with multiple toes or drag their paws. Trigger playback immediately on `pointerdown` (not `click` or `pointerup`), and apply a configurable debounce/cooldown (e.g., `500ms`) per button to prevent harsh audio spamming.
*   **Parent Mode (Configuration):**
    *   Add, edit, reorder, or delete communication buttons.
    *   Configure grid layout density (e.g., 1, 2, 4, 6, or 9 buttons per screen).
    *   Export/Import board configuration + audio backups as a single `.json` file.

### 3.2. Button Customization & Ergonomics
*   **Pet-Vision Color Palette:** Dogs are dichromats (they primarily see blues, yellows, and grays; red and green look brownish/gray to them). Provide a curated default color palette optimized for canine/feline vision:
    *   High-contrast **Royal Blue**, **Bright Yellow**, **Dark Navy**, **Light Gray**, and **White**, plus high-contrast geometric shapes/icons (Star, Circle, Triangle, Hexagon, Bowl, Paw).
*   **Custom Audio Recording:**
    *   Hold-to-record or tap-to-record microphone capture using `MediaRecorder`.
    *   Auto-trim silence or keep recordings short (max 5 seconds).
    *   Fallback option: Type a word (e.g., "Outside", "Play", "Treat") and use `speechSynthesis` if no mic recording is provided.

### 3.3. Audio Engine (Zero-Latency Requirement)
*   In behavioral training (operant conditioning), the sound **must** play the exact millisecond the paw touches the button.
*   Pre-decode all active button audio blobs into `AudioBuffer` objects in memory (`AudioContext.decodeAudioData`) when the board loads.
*   Handle iOS/Safari audio unlock policies gracefully (show a clear "Tap to Activate Soundboard" overlay on initial app launch to resume the `AudioContext`).
*   Use the **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`) while in Pet Mode so the tablet/phone screen does not turn off while lying on the floor.

### 3.4. Activity Log (Optional/Lightweight)
*   Record a simple timestamped log in IndexedDB whenever a button is pressed in Pet Mode so owners can track which words their pet uses most frequently.

---

## 4. Directory Structure
Keep the repository flat, modular, and easy to reason about:

```text
pet-comm/
├── public/
│   ├── icons/                 # PWA icons (192x192, 512x512, maskable)
│   ├── _headers               # Cloudflare Pages security & caching headers
│   └── manifest.webmanifest   # PWA Manifest (if not auto-generated)
├── src/
│   ├── main.js                # App entry point, initialization, WakeLock
│   ├── style.css              # Modern CSS, CSS Variables, Grid layout
│   ├── audio/
│   │   ├── audioEngine.js     # Web Audio API playback & pre-buffering
│   │   └── recorder.js        # MediaRecorder API wrapper
│   ├── storage/
│   │   └── db.js              # IndexedDB wrapper for buttons & audio Blobs
│   ├── ui/
│   │   ├── board.js           # Renders the Pet Mode button grid
│   │   ├── editor.js          # Modal/Drawer for Parent Mode editing
│   │   └── lock.js            # 3-second hold-to-unlock logic
│   └── utils/
│       └── defaults.js        # Default starter buttons ("Outside", "Play", "Food", "Water")
├── index.html                 # Semantic HTML shell
├── vite.config.js             # Vite & PWA configuration
├── package.json
└── AGENTS.md                  # This specification file
```

---

## 5. Cloudflare Pages Deployment Spec
*   **Build Command:** `npm run build`
*   **Build Output Directory:** `dist`
*   **Node Version:** `26.13.0`
*   Include a `public/_headers` file to enforce clean caching and security on Cloudflare Pages:
    ```text
    /*
      X-Frame-Options: DENY
      X-Content-Type-Options: nosniff
      Referrer-Policy: strict-origin-when-cross-origin
      Permissions-Policy: microphone=(self), wake-lock=(self)
    ```

---

## 6. Best Practice Instructions for AI Coding Agents

When writing, editing, or refactoring code in this repository, you (the AI Agent) **must** follow these operational rules:

### Rule 1: Zero-Bloat & Dependency Discipline
*   **Never** run `npm install` for UI libraries, state managers, icon packs, or utility libraries (like Lodash or Axios).
*   Use inline SVGs for icons (Paw, Water Drop, Bone, Ball, Door, Lock, Mic).
*   Only `vite` and `vite-plugin-pwa` (if needed) are permitted in `devDependencies`. `dependencies` in `package.json` should ideally be completely empty (`{}`).

### Rule 2: Touch & Pointer Event Precision
*   Do **not** use standard `click` events for the pet soundboard buttons (`click` waits for `pointerup` and can suffer from gesture delays).
*   Always bind soundboard triggers to `pointerdown`.
*   Apply `touch-action: manipulation;` and `user-select: none; -webkit-user-select: none;` across the entire board in CSS so a pet scratching or dragging their paw across the tablet screen does not trigger browser zooming, text selection, or pull-to-refresh.

### Rule 3: Defensive Web API Handling
*   Hardware APIs (`AudioContext`, `MediaRecorder`, `navigator.wakeLock`, `indexedDB`, `speechSynthesis`) behave differently across iOS Safari, Android Chrome, and Desktop browsers.
*   **Always** feature-detect before calling APIs (e.g., `if ('wakeLock' in navigator)`).
*   For `MediaRecorder`, dynamically check supported MIME types (`audio/webm;codecs=opus`, `audio/mp4`, `audio/ogg`) because iOS Safari prefers `audio/mp4` while Chrome prefers `audio/webm`. Store the recorded `Blob` alongside its `mimeType` string in IndexedDB.

### Rule 4: Incremental, Verifiable Execution
*   Build and verify in small, logical phases:
    1.  **Phase 1:** Scaffold Vite project, base CSS grid, and default visual buttons with TTS fallback.
    2.  **Phase 2:** Implement `IndexedDB` storage (`db.js`) and `AudioContext` engine (`audioEngine.js`).
    3.  **Phase 3:** Build the Parent Lock (3s hold) and Editor modal with `MediaRecorder` custom voice recording.
    4.  **Phase 4:** Configure PWA manifest, Service Worker offline caching, and Cloudflare Pages headers.
*   After modifying code, always run `npm run build` to verify there are no syntax or bundling errors before concluding your task.

### Rule 5: Code Style & Maintainability
*   Write clean, self-documenting ES6+ modules (`import`/`export`).
*   Keep individual files under 250 lines of code. If a file grows larger, split it by responsibility.
*   Avoid deeply nested callbacks; use `async`/`await` for all IndexedDB and Audio decoding operations.
*   Do not leave placeholder comments like `// TODO: implement recording logic here`. Write complete, working implementations.