# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@wb04307201/pretty-log` is a frontend console-logging utility that produces styled, colored output in the browser console. It is a small TypeScript library published as an npm package.

- **Package name:** `@wb04307201/pretty-log`
- **Repository:** https://github.com/wb04307201/pretty-log
  （Gitee 是上游 `gitee.com/wb04307201/pretty-log`，镜像同步到 GitHub。
  但 `package.json` 的 `repository.url` 必须写 GitHub —— npm 的 provenance
  签名会拿它与实际发布仓库比对，不一致会以 E422 拒绝发布。）
- **License:** Apache-2.0

## Key Commands

| Command | Description |
|---------|-------------|
| `yarn build` | Build the library with Parcel (outputs to `dist/`) |
| `yarn test:unit` | Run all unit tests (Node's built-in test runner; includes network-dependent tests) |
| `yarn test:unit:offline` | Run only offline tests (excludes `ci-publish.test.js`, which hits the npm registry) — this is what CI runs |
| `yarn test` | Open `test/test.html` in a browser via Parcel dev server (manual visual check) |
| `yarn verify:tag <tag>` | Verify a git tag matches `package.json` version (used in release CI) |
| `npx tsc --noEmit` | Type-check (tsconfig is strict; `test/**` is excluded) |
| `yarn install` | Install dependencies |

Run a single test file: `node --experimental-strip-types --test test/core.test.ts`
Run tests matching a name: add `--test-name-pattern="R1"`.

Note: `test:unit` requires Node ≥ 22.6 (`--experimental-strip-types`; tests import `../src/index.ts` directly). CI pins Node 24.

## Architecture

The library core lives in `src/index.ts` (trigger-word effects runtime in `src/effects.ts`, its DOM renderer in `src/effects-render.ts`). All public APIs are named exports from `src/index.ts`:

### Log functions
- **`debug` / `info` / `error` / `warning` / `success`** — Styled log boxes with color-coded borders, created via a `makeLogger` factory. With a single argument, a default title is used; with multiple arguments, the first is the title.
- **`rainbow`** — Text with a CSS rainbow gradient background.
- **`group`** — Wraps content in `console.group`/`console.groupCollapsed` with a styled header; `try...finally` guarantees `groupEnd()`.
- **`table(data, title?)`** — Self-drawn `%c` text table (default title `'Table'`): zebra striping, type coloring (`texts.warning` numbers / `texts.null` nullish / `texts.body` strings), CJK double-width alignment, 24-display-column cell truncation. Wrapped in a `console.group` shell with a `N 行 × M 列` count line for array input (mixed-shape arrays that fall back to native show only `N 行`; empty tables show `0 行 × 0 列`). Shape dispatch (`classifyTableShape`): object[] (union-of-keys columns) / array[] (index columns) / primitive[] (single `(value)` column) render pretty; other shapes (single object, Map, Set, mixed arrays) fall back to native `console.table` inside the same shell. Goes through level filtering and writes untruncated plain text to history.
- **`picture`** — Loads an image, draws to canvas, prints via background-image CSS. Has `onerror` handler.
- **`time` / `timeEnd` / `timer`** — Timers using `performance.now()` in a module-level `Map`. `timer(label, fn)` wraps a sync or async (thenable) function and guarantees `done()` on exception paths and after promise settlement.
- **`once(key, ...)`** / `clearOnce()` — Log a key only on first call.
- **`count(key)`** / `countSummary()` / `clearCounters()` — Count calls per key.
- **`assert(condition, message)`** — On failure, logs via the error channel and throws.
- **`withPrefix(prefix)`** — Returns loggers with a fixed title prefix (`debug`/`info`/`error`/`warning`/`success`/`table`; `withPrefix().table` prepends the prefix to the table title).

### Configuration API
- **`configure(options)`** — One-shot config: logLevel, theme, showEmoji, showTimestamp, historySize, tableMode, effects.
- **`setTheme(partial)` / `getTheme()` / `resetTheme()`** — Theme overrides (`ThemeUpdate` shape: `{ mode, badgeText, fills: {...}, texts: {...}, rainbow: { colors, text } }`). Nested keys are per-key optional; `undefined` restores the preset default. User overrides survive `mode` switches (`'dark' | 'light'`, default `'dark'`) — `mode` only swaps un-overridden preset values (`texts` presets differ per mode; `fills`/`rainbow`/`badgeText` are shared). `badgeText` shares the same storage slot as `setStyles({ titleColor })` (default `#1f2330`); `resetTheme()` clears overrides, returns to `dark`, and resets that slot too. Colors are read per call.
- **`setLogLevel` / `setStyles` / `setHistorySize` / `showEmoji` / `showTimestamp` / `setTableMode`** — Individual setters. Theme/`setStyles` changes take effect at call time (colors/styles are read per call, not captured at module load). `setTableMode('pretty' | 'native')` (default `'pretty'`) swaps only the table inner rendering for native `console.table` — the group shell and count line stay.
- **`getHistory()` / `clearHistory()`** — Log history buffer (fixed-size ring buffer, default 200; history stores snapshots, not live references).

### Internal behavior worth knowing
- **Production strip:** all logging functions are no-ops when `process.env.NODE_ENV === 'production'` (`IS_PRODUCTION` check in `src/index.ts`). Tests cover this.
- **`stringify(value)`** — Converts any `LogContent` to string. Distinguishes circular references from shared references (DAG) via an ancestor-chain stack, not a visited-set; formats `Error`/`Map`/`Set` meaningfully. User content is escaped (`%` → `%%`) so `%c`/`%s` in data can't corrupt styling.
- **`prettyPrint(title, text, color, level)`** — Core formatting engine building `%c`-styled `console.log` calls. Respects log level filtering and writes to history.
- **`ConfigManager`** — Global singleton holding log level, theme overrides (fills/texts/rainbow/badgeText per-slot), styles, emoji, timestamp, table mode, effects and history settings.

### Build
- **Parcel** bundles via `package.json` `source`/`main`/`module`/`types` fields; `@parcel/packager-ts` emits `dist/main.js`, `dist/module.js`, `dist/types.d.ts`.
- tsconfig targets ES2015 (lib ES2017+DOM), CommonJS, strict mode. Package manager: yarn.

## Testing

Tests use **Node's built-in test runner** (`node:test` + `node:assert/strict`), no external framework. Test files:

- `test/core.test.ts` — Regression tests for confirmed defects (numbered R1–R4), e.g. `setTheme` taking effect at call time, history sizing, circular-vs-shared ref detection.
- `test/features.test.ts` — Regression tests for fixes and features (R5–R15), e.g. `%c` escaping, emoji mapping, `once`/`count`/`timer`/`withPrefix`/`assert`, production strip.
- `test/theme.test.ts` — Theme model tests (`Theme`/`ConfigManager`/palette migration): P1 dark defaults from `getTheme()`, partial `fills`/`texts` overrides, `mode` switching only moves un-overridden keys, `undefined` restores defaults, `badgeText`/`styles.titleColor` same slot, `resetTheme`, `configure({ theme })` equivalence, call-time color reads.
- `test/table.test.ts` — Self-drawn table (`renderTable`) regression tests: shape dispatch (object[]/array[]/primitive[]/empty/native), type coloring, numeric-column right alignment, CJK double-width widths, 24-column truncation with untruncated history, zebra striping per mode, native fallback and `setTableMode('native')`, `withPrefix().table` title, `%` injection safety, circular refs, production strip.
- `test/effects.test.ts` — Trigger-word effects tests (`src/effects.ts`): default trigger table, matching precedence, cooldown, `setEffects`/`configure` wiring.
- `test/ci.test.js` — Tests for `scripts/verify-tag-version.js`.
- `test/ci-publish.test.js` — Tests for `scripts/check-version-published.js`; some cases hit the npm registry and self-skip when it's unreachable.
- `test/workflow-contract.test.js` — Contract tests asserting the auth wiring in `.github/workflows/release.yml` (e.g. `id-token: write` must exist). OIDC misconfiguration fails silently as ENEEDAUTH at release time, so these tests turn it into an early failure. Assertions target YAML keys/structure, ignoring comment lines — don't let them drift into testing comments.

Tests monkey-patch `console.*` to capture output; they reset global config between cases to avoid cross-contamination. The repo follows a TDD, RED-first convention — new regression tests are written before the fix.

For visual/manual checks, `yarn test` serves `test/test.html`, which uses `test/console-panel.js` to mirror console output onto a DOM panel (parses the `%c` format strings into styled spans).

## Release Pipeline

Publishing is **not** done locally — there is no `yarn release` script. It is driven by a GitHub Release:

1. Tag `vX.Y.Z` on Gitee (`npm version patch` first — tag must match `package.json`); Gitee's mirror syncs the tag to GitHub.
2. Create a GitHub Release for that tag → `.github/workflows/release.yml` runs: `verify-tag-version.js` → idempotency check (`check-version-published.js`) → unit tests (`test:unit:offline`) → type check → build → publish to npm.

Full docs: `RELEASING.md`. Key facts that have caused real failures:

- **Trigger is `release: types: [created]`, not tag push** — Gitee mirror syncs tags via the GitHub API (no `push` event fires), so tag-push triggers never run.
- **Trusted Publishing (OIDC), no `NPM_TOKEN`** — npm binds "GitHub Actions + wb04307201/pretty-log + release.yml" as trusted publisher (binding is immutable after creation). Requires npm ≥ 11.5.1 (workflow upgrades npm explicitly). Missing `id-token: write` fails silently as ENEEDAUTH.
- **No `registry-url` in `actions/setup-node`** — it writes a `${NODE_AUTH_TOKEN}` `.npmrc` that yarn 1 can't interpolate (`Failed to replace env in config`), breaking install before publish.
- **One `run:` key per step** — a duplicate key makes the whole workflow fail to load.
- **`package.json` `repository.url` must point at GitHub** — npm provenance compares it to the publishing repo; mismatch → E422.
- **Idempotency** — `check-version-published.js` exit codes: 0=already published (skip), 1=not published (continue), 2=check failed (abort). Protects against double-triggering.

Conventions: commit messages and code comments are written in Chinese, using conventional-commit prefixes (`fix(pkg):`, `fix(ci):`, `chore(ci):`).
