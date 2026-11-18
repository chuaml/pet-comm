import { html } from 'lit-html';

// Static help text only: the OS features below are the one way to block the home swipe, app
// switcher, Control Centre and notification shade. Menu names differ between OS versions, so the
// steps name the feature to search for rather than promising one exact path.
const GUIDES = [
  {
    title: 'iPhone / iPad — Guided Access',
    intro: 'Blocks the home swipe, Control Centre and notifications until you end it.',
    steps: [
      'Open Settings › Accessibility › Guided Access and turn it on.',
      'Tap Passcode Settings and set a Guided Access passcode.',
      'Open Pet Comm, then triple-click the side button (top button on iPad, or the Home button if your device has one).',
      'If a shortcut list appears, tap Guided Access. Then tap Start.',
      'To end: triple-click the same button, enter the passcode, and tap End.',
    ],
    tip: 'In the Guided Access settings, set Display Auto-Lock to Never so the screen stays on.',
  },
  {
    title: 'Android (Pixel and most phones) — App pinning',
    intro: 'Keeps Pet Comm on screen. A long swipe up and hold still unpins, so add the PIN prompt.',
    steps: [
      'Open Settings and search for “App pinning” (usually under Security & privacy › More security settings).',
      'Turn on app pinning and “Ask for PIN before unpinning”.',
      'Open Pet Comm, then open Recents (swipe up from the bottom and hold).',
      'Tap the app icon above the Pet Comm preview, then tap Pin.',
      'To unpin: swipe up and hold, or hold Back and Overview together with 3-button navigation.',
    ],
  },
  {
    title: 'Samsung Galaxy — Pin app',
    intro: 'Samsung’s name for app pinning. Older versions call it “Pin windows”.',
    steps: [
      'Open Settings › Security and privacy › More security settings (or “Other security settings”).',
      'Turn on “Allow apps to be pinned”, and inside it turn on locking the phone after unpinning.',
      'Open Pet Comm, then open Recents.',
      'Tap the app icon above the Pet Comm preview, then tap “Pin this app”.',
      'To unpin: hold Recents and Back together, or swipe up and hold with swipe gestures.',
    ],
  },
];

export function petProofDialogView(state, actions) {
  return html`
    <dialog
      id="petproof-dialog"
      class="app-dialog"
      closedby="any"
      aria-labelledby="petproof-dialog-title"
      @close=${actions.onPetProofNativeClose}
    >
      <div class="dialog-header">
        <h2 id="petproof-dialog-title" class="dialog-title">Pet-proof this device</h2>
        <button
          type="button"
          class="dialog-close-btn"
          aria-label="Close pet-proofing guide"
          @click=${actions.onClosePetProof}
        >
          ✕
        </button>
      </div>
      <div class="activity-dialog-body petproof-body">
        <p class="petproof-lead">
          Pet Comm blocks pinch zoom in Pet Mode. A web app cannot block the swipe that leaves the
          app or the pull-down panels. Your device can, with the built-in feature below.
        </p>
        ${GUIDES.map(
          (guide) => html`
            <section class="petproof-section">
              <h3 class="petproof-title">${guide.title}</h3>
              <p class="petproof-intro">${guide.intro}</p>
              <ol class="petproof-steps">
                ${guide.steps.map((step) => html`<li>${step}</li>`)}
              </ol>
              ${guide.tip ? html`<p class="petproof-tip">Tip: ${guide.tip}</p>` : null}
            </section>
          `
        )}
        <div class="dialog-footer">
          <span></span>
          <button type="button" class="btn-primary" autofocus @click=${actions.onClosePetProof}>Done</button>
        </div>
      </div>
    </dialog>
  `;
}
