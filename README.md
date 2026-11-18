# Pet Comm

Offline-first, zero-latency PWA soundboard that lets dogs and cats "talk" by pressing large on-screen buttons. Vanilla JS + `lit-html`, built with Vite, deployed on Cloudflare Pages. Architecture rules and constraints live in [AGENTS.md](AGENTS.md).

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
