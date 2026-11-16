# @wb04307201/pretty-log

> A frontend toolkit for beautifying console log output. It helps developers display log information in a cleaner, more readable format in the browser console.

[简体中文](README.zh-CN.md) | [English](README.md)

[![NPM](https://nodei.co/npm/@wb04307201/pretty-log.png)](https://nodei.co/npm/@wb04307201/pretty-log/)

![pretty-log output](docs/images/hero.png)

## Contributing

This project uses automated releases driven by git tags. See [RELEASING.md](RELEASING.md) for the tag workflow and the required repository secret.

## Installation
```sh
npm install @wb04307201/pretty-log
```

## Usage
```javascript
import * as prettyLog from '@wb04307201/pretty-log';

// Info
prettyLog.info("Hello world!")
prettyLog.info("Custom Title", "Hello world!")

// Error
prettyLog.error("Hello world!")
prettyLog.error("Error Title", "Something went wrong!")

// Warning
prettyLog.warning("Hello world!")
prettyLog.warning("Warning Title", "Be careful!")

// Success
prettyLog.success("Hello world!")
prettyLog.success("Success Title", "Operation completed!")

// Debug
prettyLog.debug("Debug message")
prettyLog.debug("Debug Title", "Detailed debug data", {verbose: true})

// Rainbow
prettyLog.rainbow("Colorful rainbow text in the console")

// Group output, expanded by default
prettyLog.group("A Group", ["Item 1", "Item 2", "Item 3"])

// Group output, collapsed
prettyLog.group("A Collapsed Group", ["Item 1", "Item 2", "Item 3"], false)

// Table
prettyLog.table([{a: 1, b: 1, c: 1}, {a: 2, b: 2, c: 2}, {a: 3, b: 3, c: 3}])

// Timer
prettyLog.time('myTimer');
// Do some work...
setTimeout(() => {
    prettyLog.timeEnd('myTimer');
}, 2000); // 2000 ms = 2 seconds

// Image
prettyLog.picture("https://example.com/image.png", 0.2)

// JSON format
prettyLog.info({a: 100, b: {b1: 'one', b2: 'two'}, c: [5, 6, 7]})
prettyLog.info("JSON", {a: 100, b: {b1: 'one', b2: 'two'}, c: [5, 6, 7]})
```

![Group output, tables, pictures and prefixed loggers](docs/images/advanced.png)

## Advanced Features

### Log Level Filtering
```javascript
// Only show warn and above (debug and info are filtered out)
prettyLog.setLogLevel('warn');
prettyLog.debug('will not show');
prettyLog.warning('will show');

// Levels: 'debug' < 'info' < 'warn' < 'error' < 'none'
prettyLog.setLogLevel('none');  // Disable all output
```

### Emoji Prefix
```javascript
prettyLog.showEmoji(true);
prettyLog.info("With emoji");   // ℹ️ Info ...
prettyLog.error("An error");    // ❌ Error ...
prettyLog.showEmoji(false);     // Disable
```

### Timestamp
```javascript
prettyLog.showTimestamp(true);
prettyLog.info("With timestamp");  // [14:32:05.123] Info ...
```

### Custom Theme
The theme is split by responsibility: `fills` holds badge background colors, `texts` holds text colors, `badgeText` is the badge text color, `rainbow` is the rainbow gradient, and `mode` picks the dark or light console background. By default the theme automatically follows the system (`prefers-color-scheme`) in the browser; environments without `matchMedia` (such as Node tests) default to light.
```javascript
// Partial update: keys you leave out stay untouched
prettyLog.setTheme({
  mode: 'light',                 // 'dark' | 'light' — pin manually (default: auto-follows the system)
  badgeText: '#1f2330',          // badge text color
  fills: { info: '#00FF00' },    // badge fills (shared across both backgrounds)
  texts: { error: '#FF0000' },   // text colors (per-mode presets)
  rainbow: { colors: ['#f9a8d4', '#93c5fd'], text: '#23273a' },
});

prettyLog.getTheme();    // current theme (presets merged with your overrides)
prettyLog.resetTheme();  // drop all overrides and go back to the environment default
```

Rules:

- Keys you omit stay as they are; passing `undefined` for a key restores its preset default, e.g. `setTheme({ fills: { info: undefined } })`.
- Your overrides survive `mode` switches — `mode` only swaps preset values you have not overridden. Colors are read at call time, so `setTheme` takes effect immediately.
- `badgeText` and `setStyles({ titleColor })` share the same storage slot (default `#1f2330`); `resetTheme()` resets that slot too.
- The default `mode` is resolved once at load: the browser follows `prefers-color-scheme`; without `matchMedia` (e.g. Node tests) it falls back to light. `setTheme({ mode: 'dark' | 'light' })` pins a mode manually, and `resetTheme()` returns to that environment default.
- Boundary: the page cannot read the DevTools **manually** chosen theme (a platform limitation) — if the console theme diverges from the system one, fall back to `setTheme({ mode })`.

Default palette (P1, soft and desaturated):

`fills` badge backgrounds (shared across both backgrounds):

| Key | Value | Key | Value |
|---|---|---|---|
| `debug` | `#a5b4fc` | `error` | `#fca5a5` |
| `info` | `#93c5fd` | `group` | `#c4b5fd` |
| `success` | `#86efac` | `accent` | `#93c5fd` |
| `warning` | `#fde68a` | | |

`texts` text colors (per `mode`):

| Key | Dark | Light |
|---|---|---|
| `debug` | `#a5b4fc` | `#6366f1` |
| `info` | `#93c5fd` | `#2563eb` |
| `success` | `#86efac` | `#15803d` |
| `warning` | `#fde68a` | `#b45309` |
| `error` | `#fca5a5` | `#dc2626` |
| `group` | `#c4b5fd` | `#6d28d9` |
| `time` | `#93c5fd` | `#2563eb` |
| `null` | `#8b93a7` | `#6b7280` |
| `meta` | `#8b93a7` | `#5f6368` |
| `body` | `#e8eaed` | `#3c4043` |

`badgeText` defaults to `#1f2330`; `rainbow` defaults to the gradient `#f9a8d4 → #c4b5fd → #93c5fd → #6ee7b7 → #fde68a` with text `#23273a` (both shared across backgrounds).

![Side-by-side appearance on dark and light consoles](docs/images/theme-compare.png)

> Both backgrounds are now covered: the default mode follows the system, so a light console gets the light presets out of the box (pin `setTheme({ mode })` only when the console theme diverges from the system); your overrides carry over across modes.

#### Migrating from the Old Color Keys (Breaking)

The flat color keys are gone (breaking change) — rewrite them as follows:

| Old key (removed) | New spelling |
|---|---|
| `infoColor` | `fills.info` + `texts.info` |
| `errorColor` | `fills.error` + `texts.error` |
| `warningColor` | `fills.warning` + `texts.warning` |
| `successColor` | `fills.success` + `texts.success` |
| `debugColor` | `fills.debug` + `texts.debug` |
| `groupColor` | `fills.group` + `texts.group` |
| `timeColor` | `fills.accent` + `texts.time` |

### Pretty Table
`table(data, title?)` draws its own `%c` text table (title defaults to `'Table'`): zebra striping, type coloring (numbers in `texts.warning`, including numeric-style strings like `'92.5'`; nullish values in `texts.null`; strings in `texts.body`; missing-key cells get no type color), CJK double-width alignment, and cells truncated past 24 display columns. Everything is wrapped in a `console.group`; array input also gets a `N 行 × M 列` (rows x columns) count line — mixed-shape arrays that fall back to native show only `N 行`, and an empty table shows `0 行 × 0 列`.

Shape dispatch: arrays of objects (union-of-keys columns), arrays of arrays (index columns) and arrays of primitives (a single `(value)` column) render pretty; anything else — a single object, `Map`, `Set`, mixed-shape arrays — falls back to native `console.table` inside the group shell (keeping column sorting, object expansion and other interactions). Like the other log functions it respects level filtering and writes to history (untruncated plain text).

```javascript
prettyLog.table([{ a: 1, b: '一' }, { a: 2, b: '二' }], '用户列表');
```

Escape hatch: when you want the native interactive table back (or the pretty renderer does not fit), switch the inner rendering to `console.table` — the group shell and count line stay:

```javascript
prettyLog.setTableMode('native');   // 'pretty' (default) | 'native'
prettyLog.setTableMode('pretty');   // back to the pretty renderer
// equivalent: prettyLog.configure({ tableMode: 'native' })
```

`withPrefix(prefix).table` behaves exactly like `table`, with the prefix added to the title.

### One-Shot Configuration
```javascript
prettyLog.configure({
  logLevel: 'info',
  showEmoji: true,
  showTimestamp: true,
  theme: { fills: { info: '#00FF00' } },
  tableMode: 'pretty',
});
```

### Log History
```javascript
// Get recent log entries (default buffer size: 200)
const history = prettyLog.getHistory();
console.log(JSON.stringify(history, null, 2));

// Adjust history size (set to 0 to disable).
// Illegal values are clamped rather than throwing, and existing
// entries are preserved (most recent kept when shrinking).
prettyLog.setHistorySize(500);

// Clear history
prettyLog.clearHistory();
```

### Async Timer
`timer` ends the timer on both the resolve and the throw/reject path, and never swallows the original error.
```javascript
// Sync work — logs immediately
const result = prettyLog.timer('parse', () => JSON.parse(raw));

// Async work — logs when the promise settles
await prettyLog.timer('fetch-user', () => fetch('/api/user').then(r => r.json()));

// Errors still end the timer and propagate to your caller
await prettyLog.timer('risky', () => Promise.reject(new Error('boom')));
```

### Log Once
Useful for debug logs inside loops — the same key prints only once.
```javascript
for (const item of items) {
  prettyLog.once('render', 'Component rendered', item.id);
}

prettyLog.clearOnce();  // allow all keys again
```

### Call Counting
```javascript
items.forEach(i => prettyLog.count('api-call'));

console.log(prettyLog.countSummary());  // { 'api-call': 42 }
prettyLog.clearCounters();
```

### Prefixed Logger
Returns loggers (`debug` / `info` / `error` / `warning` / `success` / `table`) that carry a fixed prefix while keeping the same level, theme and filtering.
```javascript
const userLog = prettyLog.withPrefix('用户模块');
userLog.info('登录成功', { userId: 123 });
// [用户模块] 登录成功
// {"userId":123}
```

### Assertions
Stays silent when the condition holds; on failure it logs via `console.error` (highlighted red in DevTools) and throws.
```javascript
prettyLog.assert(user != null, 'user must not be null');
```

### Custom Styles
```javascript
prettyLog.setStyles({ borderRadius: '8px', padding: '3px 10px' });

// Pass undefined to restore a default
prettyLog.setStyles({ borderRadius: undefined });
```

### Production Strip
Every logging API becomes a silent no-op when `NODE_ENV=production`, so debug calls can stay in the source without polluting production bundles.
```javascript
// In production this prints nothing
prettyLog.info('this never shows up');
```

Note: `timer` still runs the function you give it in production — only the logging is suppressed.

### Trigger-Word Animations (Easter Egg)
When the stringified log text contains a trigger word, a full-screen particle animation plays in the page. Matching is a case-sensitive substring check in table order — the first hit wins, one animation per log call, and consecutive hits only play once (about a 2-second cooldown after each play).

![Confetti and lightning triggered by log text](docs/images/effects.gif)

Default trigger table:

| Trigger word | Animation |
|---|---|
| 打雷 | `lightning` |
| 雷人 | `lightning` |
| 下雨 | `rain` |
| 暴雨 | `rain` |
| 翻车了 | `rain` |
| 凉了 | `rain` |
| 寄了 | `rain` |
| 芭比Q了 | `rain` |
| 下雪 | `snow` |
| 雪花 | `snow` |
| 初雪 | `snow` |
| 烟花 | `fireworks` |
| 撒花 | `confetti` |
| 庆祝 | `confetti` |
| 好耶 | `confetti` |
| 恭喜 | `confetti` |

Key order is match priority: bad-news words come first, so '庆祝上线翻车了' plays rain (翻车了 beats 庆祝).

```javascript
import { configure, setEffects, DEFAULT_EFFECT_TRIGGERS } from '@wb04307201/pretty-log';

// setEffects({ triggers }) replaces the whole table — spread
// DEFAULT_EFFECT_TRIGGERS to keep the defaults and extend them
setEffects({ triggers: { ...DEFAULT_EFFECT_TRIGGERS, '开工': 'confetti' } });

// One-shot kill switch
setEffects({ enabled: false });

// Also configurable through configure()
configure({ effects: { enabled: true, cooldownMs: 2000 } });
```

Note: no animation plays when `NODE_ENV=production`.
Note: no animation plays when the user prefers reduced motion (`prefers-reduced-motion: reduce`).
