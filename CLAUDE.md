# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@wb04307201/pretty-log` is a frontend console-logging utility that produces styled, colored output in the browser console. It is a small TypeScript library published as an npm package.

- **Package name:** `@wb04307201/pretty-log`
- **Repository:** https://gitee.com/wb04307201/pretty-log
- **License:** Apache-2.0

## Key Commands

| Command | Description |
|---------|-------------|
| `yarn build` | Build the library with Parcel (outputs to `dist/`) |
| `yarn release` | Clean, build, and publish to npm (public access) |
| `yarn test` | Open `test/test.html` in a browser via Parcel dev server |
| `yarn install` | Install dependencies |

## Architecture

The entire library lives in a single file: `src/index.ts`. All public APIs are named exports:

### Log functions
- **`debug` / `info` / `error` / `warning` / `success`** — Styled log boxes with color-coded borders. Created via a `makeLogger` factory that accepts a default title, color, and log level. With a single argument, a default title is used. With multiple arguments, the first is the title.
- **`rainbow`** — Prints text with a CSS rainbow gradient background.
- **`group`** — Wraps content in a `console.group` / `console.groupCollapsed` with styled header. Uses `try...finally` to guarantee `groupEnd()`.
- **`table`** — Thin wrapper around `console.table` for object arrays or plain objects.
- **`picture`** — Loads an image from a URL, draws it to a canvas, and prints it to the console via background-image CSS trickery. Has `onerror` handler for load failures.
- **`time` / `timeEnd`** — Custom timers using `performance.now()` stored in a module-level `Map<string, number>`. Uses `has()` for safe lookup (handles `startTime === 0`).

### Configuration API
- **`configure(options)`** — One-shot configuration (logLevel, theme, showEmoji, showTimestamp, historySize).
- **`setLogLevel(level)`** — Set log level: `'debug' | 'info' | 'warn' | 'error' | 'none'`.
- **`setTheme(partial)`** — Merge partial theme overrides.
- **`showEmoji(enabled)`** / **`showTimestamp(enabled)`** — Toggle features.
- **`getHistory()` / `clearHistory()`** — Access and clear the log history buffer.

### Internal components
- **`ConfigManager`** — Global singleton managing log level, theme, emoji, timestamp, and history settings.
- **`HistoryBuffer`** — Fixed-size ring buffer for log history (configurable size, default 200).
- **`stringify(value)`** — Converts any `LogContent` to string. Uses `WeakSet` replacer to handle circular references safely.
- **`prettyPrint(title, text, color, level)`** — Core formatting engine that builds `%c`-styled `console.log` calls. Respects log level filtering and writes to history.

### Build

- **Parcel** handles bundling (`yarn build`), driven by `package.json` `source` and `main`/`module`/`types` fields.
- **Parcel TypeScript packager** (`@parcel/packager-ts`, `@parcel/transformer-typescript-types`) produces `dist/main.js`, `dist/module.js`, and `dist/types.d.ts`.
- **tsconfig.json** targets ES2015 with ES2017+DOM lib, CommonJS modules, strict mode enabled, root dir `src/`, output dir `dist/`.
- **Package manager:** yarn (lock file: `yarn.lock`).

## Testing

There is no automated test framework. Testing is done manually by running `yarn test`, which serves `test/test.html` via Parcel's dev server — open the browser console to see all API outputs.
