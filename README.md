# Pet Comm

Offline-first, zero-latency PWA soundboard that lets dogs and cats "talk" by pressing large on-screen buttons. Vanilla JS + `lit-html`, built with Vite, deployed on Cloudflare Pages. Architecture rules and constraints live in [AGENTS.md](AGENTS.md).

## Parent lock

Pet Mode shows a small lock in a strip above the buttons. To open Parent Mode, **hold the lock for about half a second, slide it left to the end of the track, and let go there**. A tap, a long press without a slide, or letting go early does nothing, so paws and noses do not open the settings. On a keyboard, hold Enter on the lock, then press the Left Arrow.

## Button gap

**Button Gap** in Parent Mode sets the empty space between buttons: Compact, Comfortable (default), Wide, or Extra Wide. A wider gap makes it less likely that one paw presses two buttons. Buttons keep their positions and get slightly smaller.

## Pet-proofing the device

Pet Mode blocks pinch zoom. A web app cannot block the swipe that leaves the app, the app switcher, Control Centre, or the notification shade; the device has to do that. The same steps are in Parent Mode under **Pet-proof**. Menu names vary between OS versions, so search Settings for the feature name if a path does not match.

- **iPhone / iPad — Guided Access.** Settings › Accessibility › Guided Access: turn it on and set a passcode. Open Pet Comm, triple-click the side button (top button on iPad, or the Home button), and tap Start. Triple-click again and enter the passcode to end. Set Display Auto-Lock to Never in the Guided Access settings to keep the screen on.
- **Android (Pixel and most phones) — App pinning.** Search Settings for "App pinning", turn it on, and turn on "Ask for PIN before unpinning". Open Pet Comm, open Recents, tap the app icon above the preview, and tap Pin. Swipe up and hold to unpin (or hold Back and Overview with 3-button navigation). A long swipe-and-hold still unpins, so this is weaker than Guided Access.
- **Samsung Galaxy — Pin app.** Settings › Security and privacy › More security settings › "Allow apps to be pinned". Open Pet Comm, open Recents, tap the app icon, and tap "Pin this app". Hold Recents and Back together to unpin.

## Attention cue (optional)

If your pet stops pressing on their own, set **Remind every (sec, 0 = off)** in Parent Mode. After that many idle seconds in Pet Mode, the last pressed button pulses with a glowing ring for about 2.4 s, and repeats until a button is pressed. It is off by default, silent, and never moves a button out of its slot.

## Slow first word after idle

Tablets and Chromebooks unload their speech engine when it is unused, so the first spoken word after a long idle can lag. The app wakes the engine silently when the soundboard is activated and about once a minute while Pet Mode is on screen with the device voice, and it no longer restarts the engine's wake-up on every press. For preset words, loading the Human Voice Pack (Parent Mode → Voice Tune) avoids the device voice entirely.

To check a device, open Voice Tune → **Speech diagnostics**: it shows how long the device voice took to start after each press and the last speech error, with a **Copy report** button. Nothing in the report is stored or sent anywhere.

## Development

Requires Node `>= 26.13.0`.

```sh
npm install
npm run dev       # local dev server
npm run build     # production build to dist/
npm run preview   # serve the production build
```

## Testing

Tests use Vitest (`happy-dom` + `fake-indexeddb`) and live in `tests/*.test.js`.

| Command | What it does |
| :--- | :--- |
| `npm test` | Run the full suite once |
| `npm run test:watch` | Watch mode (humans only — it never exits) |
| `npm run test:coverage` | Full suite with V8 coverage (`coverage/` HTML report) |
| `npm run test:agent` | Full suite with the failures-only reporter forced on |
| `npx vitest run tests/colors.test.js` | Run a single file |
| `npx vitest run -t "name substring"` | Run tests matching a name |
| `npx vitest related --run src/utils/colors.js` | Run only tests that import the given source files (ran all 9 files for this example when tried; a single test file narrows more reliably) |
| `npx vitest run --changed` | Run only tests affected by uncommitted changes (ran all files while `vite.config.js` was modified) |

### AI agent runs

When an AI coding agent runs the tests, `vite.config.js` detects it (`ANTIGRAVITY_AGENT`, `GEMINI_CLI`, `CLAUDECODE`, `CURSOR_AGENT`, `CODEX_SANDBOX`, or an explicit `AI_AGENT=1`) and switches to compact output:

- passing runs print only the summary; failing runs print only the failed tests with diff, code frame, and their console output
- console output from passing tests is hidden
- coverage prints a table of not-fully-covered files plus a summary and skips the HTML report
- watch mode is disabled so the command always exits: bare `vitest` and `npm run test:watch` run once, and an explicit `--watch`, `-w`, `vitest watch` or `vitest dev` fails immediately with an error

Set `AI_AGENT=1` to get this output from any shell. Agent workflow guidance is in [AGENTS.md § 4](AGENTS.md#4-running-tests-efficiently-agents).

## Other scripts

```sh
npm run icons        # regenerate PWA icons
npm run voice-pack   # regenerate the optional Human Voice Pack (public/voice-pack/)
```
