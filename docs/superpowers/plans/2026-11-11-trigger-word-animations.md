# 触发词动画（日志彩蛋）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日志内容命中触发词时在页面播放一段 canvas 粒子动画（烟花/撒花/下雪）——词表可配置、全局防轰炸（单飞 + 约 2 秒冷却）、`pointer-events:none` 不干扰操作，production 与无 DOM 环境零副作用。

**Architecture:** 新增两个模块：`src/effects.ts`（纯逻辑：类型、默认词表、匹配、单飞+冷却运行时，Node 无 DOM 可测）与 `src/effects-render.ts`（浏览器渲染：三组参数的粒子引擎 + overlay 播放器，缺 DOM 时安全跳过）。`src/index.ts` 只做配置接线，并在各输出总入口（级别过滤之后）调用一次 `triggerEffects`。三个动画 = 一台引擎的三组参数，形态以已存档 mockup 为视觉基准。

**Tech Stack:** TypeScript（strict）、原生 Canvas 2D、`node:test` + `node:assert/strict`（红先行 TDD）、Parcel 构建（出口不变）。零依赖。

**Spec:** `docs/superpowers/specs/2026-11-11-trigger-word-animations-design.md`（视觉基准：`docs/superpowers/specs/2026-11-11-trigger-word-animations-mockup.html`）

## Global Constraints

- 零依赖；`yarn build`（Parcel）产物兼容现有 main/module/types 出口，构建入口仍是 `src/index.ts`。
- 测试跑在 Node、无 DOM：匹配、冷却、配置必须可单测；canvas 渲染只在浏览器执行，缺 `window`/`document` 时安全跳过。**新增模块顶层不得触碰 DOM**（Node import 安全）。
- 遵守 `prefers-reduced-motion: reduce`——命中时不播，直接静默。
- `NODE_ENV=production` 整体 no-op（与日志行为一致）。
- 防轰炸：同一时刻全局最多一个动画；播放结束后约 **2000ms** 冷却（`DEFAULT_EFFECT_COOLDOWN_MS = 2000`）；单飞与冷却不分动画类型。
- 匹配规则：对 stringify 后文本做子串匹配；触发词必须是**词组**（≥2 字符，不收单字）；英文**大小写敏感**（`OK` 不匹配 `ok`）；一次日志调用最多触发一个动画，多词命中取**映射表中第一个**匹配项。
- 默认词表只收感叹性词：`烟花`→fireworks；`撒花`、`庆祝`、`好耶`→confetti；`下雪`、`雪花`→snow。禁止业务高频词（成功/完成/加载等）。
- 日志被 logLevel 过滤掉时不播动画。
- 动画时长以 mockup 为基准：fireworks ≤ 7s、confetti ≤ 6s、snow ≤ 7s，粒子提前散尽提前收。
- tsconfig strict（`npx tsc --noEmit` 只查 `src/`）；`node:test` 红先行 TDD；回归用例编号从 **R16** 延续（R1–R15 已用）。
- 新测试文件必须加入 `package.json` `test:unit:offline` 的**显式文件列表**。
- 提交信息中文 + conventional-commit 前缀，结尾加 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。

## Review Focus

1. **连发命中轰炸**：连打一百条含「烟花」的日志，只该看到一次绽放，绝不连播或排队补播。→ 钉住：Task 3 的 **R25**（100 连发 play 只被调一次）。
2. **触发词误伤业务日志**：默认词表若混入单字或业务高频词，普通日志会反复触发动画。→ 钉住：Task 1 的 **R16**（默认词表精确断言 + 每个键 ≥2 字符）。
3. **无 DOM（Node/SSR）环境**：在 Node 里 import 本库并打出含触发词的日志，不得抛错、不得有副作用。→ 钉住：Task 4 的 **R27**（无 DOM 调 `playEffectInBrowser` 立即 onEnd 不抛错）与 Task 5 的 **R33**（无 DOM 全链路 `info('烟花')` 不抛错）。
4. **动画层干扰用户**：overlay 若可点或播完残留，会挡住页面操作。→ 钉住：Task 5 的 **R28**（cssText 精确含 `pointer-events:none;z-index:99999`，播完 `remove()` 被调用）。
5. **环境开关失效**：production 或 `prefers-reduced-motion` 下仍播动画。→ 钉住：Task 5 的 **R30**（production 不创建 canvas）与 **R31**（reduced-motion 不创建 canvas）。

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/effects.ts` | 新建 | 纯逻辑：`EffectType`/`EffectsOptions`/默认词表/`matchEffect`/`createEffectsRuntime` |
| `src/effects-render.ts` | 新建 | 浏览器渲染：粒子引擎 `createEffectEngine` + 播放器 `playEffectInBrowser` |
| `src/index.ts` | 修改 | ConfigManager/configure/setEffects 接线；7 处输出入口调 `triggerEffects` |
| `test/effects.test.ts` | 新建 | R16 起全部回归用例 + fake DOM 测试脚手架 |
| `package.json` | 修改 | `test:unit:offline` 显式列表加入 `test/effects.test.ts` |
| `test/test.html` | 修改 | 「触发词彩蛋」演示区（手动视觉检查） |
| `README.md`、`README.zh-CN.md` | 修改 | 功能说明、默认词表、配置示例 |

---

### Task 1: 效果配置类型与配置接线

**Files:**
- Create: `src/effects.ts`（本任务只放类型与默认常量）
- Create: `test/effects.test.ts`
- Modify: `src/index.ts`（ConfigManager 增效果状态 ~:175；ConfigOptions ~:994；configure ~:1012；新增 `setEffects`/`getEffects`；re-export 类型与常量）
- Modify: `package.json`（`test:unit:offline` 显式列表追加 `test/effects.test.ts`）

**Interfaces:**
- Consumes: 现有 `ConfigManager`（src/index.ts:175）、`configure`（src/index.ts:1012）、`setStyles`/`setTheme` 的 partial-setter 模式（src/index.ts:1037、:1055）。
- Produces:
  - `src/effects.ts` 导出：
    ```ts
    export type EffectType = 'fireworks' | 'confetti' | 'snow';
    export interface EffectsOptions {
      enabled?: boolean;
      triggers?: Record<string, EffectType>;
      cooldownMs?: number;
    }
    export const DEFAULT_EFFECT_TRIGGERS: Record<string, EffectType>;
    export const DEFAULT_EFFECT_COOLDOWN_MS = 2000;
    ```
    `DEFAULT_EFFECT_TRIGGERS` 键序（插入序，决定多词命中取谁）：`烟花`→`fireworks`、`撒花`→`confetti`、`庆祝`→`confetti`、`好耶`→`confetti`、`下雪`→`snow`、`雪花`→`snow`。
  - `src/index.ts` 新增导出：`export type { EffectType, EffectsOptions }`（自 `./effects` re-export）、`export { DEFAULT_EFFECT_TRIGGERS }`、
    ```ts
    export const setEffects = (partial: EffectsOptions): void;   // 合并覆盖；triggers 传入即整表替换；undefined 项不动
    export const getEffects = (): Required<EffectsOptions>;      // 返回副本（triggers 浅拷贝）
    ```
  - `ConfigOptions` 增 `effects?: EffectsOptions`；`ConfigManager` 增私有 `applyEffects(partial: EffectsOptions): void` 与内部 getter `effectOptions(): Required<EffectsOptions>`（不拷贝，供挂钩读取）。
  - 默认状态：`enabled: true`、`triggers: { ...DEFAULT_EFFECT_TRIGGERS }`、`cooldownMs: 2000`。

- [ ] **Step 1: 写失败测试**（`test/effects.test.ts`；文件头沿用 features.test.ts 的 import 风格）

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EFFECT_TRIGGERS, DEFAULT_EFFECT_COOLDOWN_MS } from '../src/effects.ts';
import { configure, setEffects, getEffects } from '../src/index.ts';

test('R16: 默认触发词表精确、均≥2字符、默认状态正确', () => {
  assert.deepEqual(DEFAULT_EFFECT_TRIGGERS, {
    '烟花': 'fireworks',
    '撒花': 'confetti',
    '庆祝': 'confetti',
    '好耶': 'confetti',
    '下雪': 'snow',
    '雪花': 'snow',
  });
  for (const key of Object.keys(DEFAULT_EFFECT_TRIGGERS)) {
    assert.ok(key.length >= 2, `触发词「${key}」必须是词组，不收单字`);
  }
  assert.equal(DEFAULT_EFFECT_COOLDOWN_MS, 2000);
  assert.deepEqual(getEffects(), {
    enabled: true,
    triggers: DEFAULT_EFFECT_TRIGGERS,
    cooldownMs: 2000,
  });
});

test('R17: configure/setEffects 部分合并，triggers 整表替换', () => {
  try {
    configure({ effects: { cooldownMs: 5000 } });
    assert.equal(getEffects().cooldownMs, 5000);
    assert.equal(getEffects().enabled, true);                    // 未提及项不动
    assert.deepEqual(getEffects().triggers, DEFAULT_EFFECT_TRIGGERS);

    setEffects({ triggers: { 'OK': 'confetti' } });              // 整表替换而非合并
    assert.deepEqual(getEffects().triggers, { 'OK': 'confetti' });

    setEffects({ enabled: false });
    assert.equal(getEffects().enabled, false);
    assert.equal(getEffects().cooldownMs, 5000);                 // 未提及项不动
  } finally {
    setEffects({ enabled: true, triggers: { ...DEFAULT_EFFECT_TRIGGERS }, cooldownMs: 2000 });
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test test/effects.test.ts`
Expected: FAIL，报 `../src/effects.ts` 无对应导出（模块不存在）。

- [ ] **Step 3: 实现类型与配置接线**

`src/effects.ts` 放上述四个导出（`DEFAULT_EFFECT_TRIGGERS` 用对象字面量，键序即命中优先级）。`src/index.ts`：
- `import { DEFAULT_EFFECT_TRIGGERS, DEFAULT_EFFECT_COOLDOWN_MS, type EffectType, type EffectsOptions } from './effects';` 并 re-export 类型与 `DEFAULT_EFFECT_TRIGGERS`。
- `ConfigManager` 增 `_effectsEnabled = true`、`_effectTriggers = { ...DEFAULT_EFFECT_TRIGGERS }`、`_effectCooldownMs = DEFAULT_EFFECT_COOLDOWN_MS`；`applyEffects` 只处理 `!== undefined` 的项（`triggers` 提供即整体替换，允许 `{}`）；`effectOptions()` 返回 `{ enabled, triggers: this._effectTriggers, cooldownMs }`。
- `ConfigOptions` 增 `effects?: EffectsOptions`；`configure` 末尾加 `if (options.effects !== undefined) config.applyEffects(options.effects);`。
- 文件末尾配置区加 `setEffects`、`getEffects`（`getEffects` 返回 `{ ...effectOptions(), triggers: { ...effectOptions().triggers } }` 形状的副本）。
- `package.json` 的 `test:unit:offline` 文件列表追加 `test/effects.test.ts`（在 `test/features.test.ts` 之后）。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test test/effects.test.ts` → PASS；再跑 `npx tsc --noEmit` → 无错误。

- [ ] **Step 5: 提交**

```bash
git add src/effects.ts src/index.ts test/effects.test.ts package.json
git commit -m "feat(pkg): 新增触发词动画配置（默认词表/开关/冷却）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 触发词匹配 matchEffect

**Files:**
- Modify: `src/effects.ts`（增 `matchEffect`）
- Test: `test/effects.test.ts`

**Interfaces:**
- Consumes: `EffectType`、`DEFAULT_EFFECT_TRIGGERS`（Task 1）。
- Produces:
  ```ts
  export function matchEffect(text: string, triggers: Record<string, EffectType>): EffectType | null;
  ```
  语义：按 `triggers` 插入序遍历，第一个 `text.includes(key)` 命中的键返回其动画类型；空串键跳过（`includes('')` 恒真，必须显式排除）；用原生 `includes`，大小写敏感；无命中返回 `null`。

- [ ] **Step 1: 写失败测试**

```ts
import { matchEffect } from '../src/effects.ts';
// EffectType 类型自 '../src/effects.ts' 引入

test('R18: 多词命中取映射表中第一个匹配项', () => {
  assert.equal(matchEffect('烟花和撒花', DEFAULT_EFFECT_TRIGGERS), 'fireworks');
  const reversed: Record<string, EffectType> = { '撒花': 'confetti', '烟花': 'fireworks' };
  assert.equal(matchEffect('烟花和撒花', reversed), 'confetti');   // 换映射顺序结果跟着换
});

test('R19: 大小写敏感、空键忽略', () => {
  const t: Record<string, EffectType> = { 'OK': 'confetti', '': 'snow' };
  assert.equal(matchEffect('ok ok OK', t), 'confetti');            // 只有原文大写 OK 命中
  assert.equal(matchEffect('ok', t), null);                        // 小写不命中；空键不得命中一切
});

test('R20: 自定义词表生效，无命中返回 null', () => {
  const t: Record<string, EffectType> = { '恭喜': 'snow' };
  assert.equal(matchEffect('恭喜发财', t), 'snow');
  assert.equal(matchEffect('普通日志', t), null);
  assert.equal(matchEffect('普通日志', DEFAULT_EFFECT_TRIGGERS), null);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test test/effects.test.ts` → FAIL，`matchEffect` 未导出。

- [ ] **Step 3: 实现 `matchEffect`（约 8 行：遍历 `Object.entries(triggers)`，跳过 `key.length === 0`，`includes` 命中即返回）**

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test test/effects.test.ts` → PASS（含 Task 1 用例）。

- [ ] **Step 5: 提交**

```bash
git add src/effects.ts test/effects.test.ts
git commit -m "feat(pkg): 触发词匹配——映射顺序首个命中、大小写敏感

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 防轰炸运行时（单飞 + 冷却）

**Files:**
- Modify: `src/effects.ts`（增 `EffectPlay`/`EffectsRuntime`/`createEffectsRuntime`）
- Test: `test/effects.test.ts`

**Interfaces:**
- Consumes: `matchEffect`（Task 2）、`EffectsOptions`（Task 1）。
- Produces:
  ```ts
  export type EffectPlay = (type: EffectType, onEnd: () => void) => void;
  export interface EffectsRuntime {
    handle(text: string, opts: Required<EffectsOptions>, play: EffectPlay): EffectType | null;
  }
  export function createEffectsRuntime(clock: () => number = Date.now): EffectsRuntime;
  ```
  契约（后续任务依赖）：
  - `handle` 流程：`opts.enabled === false` → `null`；`matchEffect` 未命中 → `null`；正在播放（单飞）或 `clock() < cooldownUntil`（冷却中）→ `null`；否则标记播放中、调 `play(type, onEnd)`、返回 `type`。
  - 冷却自**播放结束**起算：`onEnd()` 时置 `cooldownUntil = clock() + opts.cooldownMs`，同时释放单飞。
  - `play` 契约：必须恰好调用一次 `onEnd`（无法播放时立即调用）。`handle` 对 `onEnd` 做防重入；`play` 抛错时代为调用 `onEnd` 释放并把异常吞掉（动画是彩蛋，绝不影响日志链路）。
  - 每个 `createEffectsRuntime()` 实例有独立状态——测试用例各自新建，天然隔离。

- [ ] **Step 1: 写失败测试**（文件内加一个 `opts()` 助手）

```ts
const opts = (over: Partial<EffectsOptions> = {}): Required<EffectsOptions> => ({
  enabled: true,
  triggers: { ...DEFAULT_EFFECT_TRIGGERS },
  cooldownMs: 2000,
  ...over,
});

test('R21: 命中才调 play 并返回类型，未命中返回 null', () => {
  const rt = createEffectsRuntime(() => 0);
  const calls: EffectType[] = [];
  const play: EffectPlay = (type, onEnd) => { calls.push(type); onEnd(); };
  assert.equal(rt.handle('烟花', opts(), play), 'fireworks');
  assert.equal(rt.handle('普通日志', opts(), play), null);
  assert.deepEqual(calls, ['fireworks']);
});

test('R22: 播放中再次命中被跳过（单飞）', () => {
  const rt = createEffectsRuntime(() => 0);
  const calls: EffectType[] = [];
  const play: EffectPlay = (type, onEnd) => { calls.push(type); void onEnd; };  // 故意不结束
  assert.equal(rt.handle('烟花', opts(), play), 'fireworks');
  assert.equal(rt.handle('撒花', opts(), play), null);
  assert.deepEqual(calls, ['fireworks']);
});

test('R23: 冷却自播放结束起算，期内跳过、期满恢复', () => {
  let now = 0;
  const rt = createEffectsRuntime(() => now);
  let finish: () => void = () => {};
  const play: EffectPlay = (_type, onEnd) => { finish = onEnd; };
  assert.equal(rt.handle('烟花', opts(), play), 'fireworks');
  now = 5000;
  finish();                                       // 5000ms 时播完 → cooldownUntil = 7000
  now = 6999;
  assert.equal(rt.handle('烟花', opts(), play), null);      // 冷却中
  now = 7000;
  assert.equal(rt.handle('烟花', opts(), play), 'fireworks'); // 冷却结束
});

test('R24: enabled=false 时恒不触发', () => {
  const rt = createEffectsRuntime(() => 0);
  const play: EffectPlay = (_t, onEnd) => onEnd();
  assert.equal(rt.handle('烟花', opts({ enabled: false }), play), null);
});

test('R25: 连发 100 次命中只播一次（防轰炸）', () => {
  const rt = createEffectsRuntime(() => 0);
  let plays = 0;
  const play: EffectPlay = (_t, onEnd) => { plays++; onEnd(); };
  for (let i = 0; i < 100; i++) rt.handle('烟花', opts(), play);
  assert.equal(plays, 1);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test test/effects.test.ts` → FAIL，`createEffectsRuntime` 未导出。

- [ ] **Step 3: 实现 `createEffectsRuntime`**——闭包内两个状态 `playing: boolean`、`cooldownUntil: number`（初值 0），按上面契约实现 `handle`；`matchEffect` 用 Task 2 的导出。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test test/effects.test.ts` → PASS（R16–R25 全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/effects.ts test/effects.test.ts
git commit -m "feat(pkg): 动画防轰炸运行时——全局单飞与播后2秒冷却

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 粒子引擎与浏览器播放器（effects-render）

**Files:**
- Create: `src/effects-render.ts`
- Test: `test/effects.test.ts`（追加 R26–R27）

**Interfaces:**
- Consumes: `EffectType`（Task 1）、`EffectPlay` 的 `onEnd` 约定（Task 3）。
- Produces:
  ```ts
  export interface EffectEngine {
    step(ctx: CanvasRenderingContext2D, dt: number): boolean;   // true = 本动画收尾完成
  }
  export function createEffectEngine(type: EffectType, w: number, h: number): EffectEngine;
  export function playEffectInBrowser(type: EffectType, onEnd: () => void): void;
  ```
  契约：
  - `step` 推进并绘制一帧，返回 `true` 表示收尾——粒子提前散尽**或**累计时长达到 `MAX_MS[type]`（内部封顶：`{ fireworks: 7000, confetti: 6000, snow: 7000 }`，与 mockup 一致）；收尾后保持返回 `true`。
  - `playEffectInBrowser`：缺 `window`/`document`/`requestAnimationFrame` 时立即 `onEnd()`；`matchMedia('(prefers-reduced-motion: reduce)').matches` 为真立即 `onEnd()`；`getContext('2d')` 为 null 时移除画布并 `onEnd()`。以上任何分支都**不抛错**。
  - 正常分支：创建 canvas，`style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:99999'`，append 到 `document.body`；DPR 取 `Math.min(window.devicePixelRatio || 1, 2)` 并 `setTransform`；视口尺寸用 `window.innerWidth/innerHeight`；rAF 循环调 `step`，收尾后 `canvas.remove()` 再 `onEnd()`。
  - 模块顶层不得触碰 DOM。

- [ ] **Step 1: 写失败测试**

```ts
import { createEffectEngine, playEffectInBrowser } from '../src/effects-render.ts';

test('R26: 三个引擎在 MAX_MS 对应帧数内必然收尾', () => {
  const ctx = new Proxy({} as object, {
    get: () => () => undefined,
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const limits = { fireworks: 7000, confetti: 6000, snow: 7000 } as const;
  for (const type of ['fireworks', 'confetti', 'snow'] as const) {
    const engine = createEffectEngine(type, 800, 600);
    let done = false;
    let frames = 0;
    while (!done && frames < 2000) { done = engine.step(ctx, 16.7); frames++; }
    assert.ok(done, `${type} 必须收尾`);
    assert.ok(frames <= Math.ceil(limits[type] / 16.7) + 1, `${type} 帧数超出时长上限`);
  }
});

test('R27: 无 DOM 环境 playEffectInBrowser 立即 onEnd 且不抛错', () => {
  let ended = 0;
  playEffectInBrowser('fireworks', () => { ended++; });
  assert.equal(ended, 1);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test test/effects.test.ts` → FAIL，`../src/effects-render.ts` 不存在。

- [ ] **Step 3: 实现 `src/effects-render.ts`**

粒子参数**照抄存档 mockup**（`docs/superpowers/specs/2026-11-11-trigger-word-animations-mockup.html` 的 `makeFireworks`/`makeConfetti`/`makeSnow`，约第 95–241 行）：颜色、重力、扩散、拖尾、深色描边/底衬一个都不要改——形态走样即失败。三个 maker 合成 `createEffectEngine(type, w, h)`，在返回的 `step` 里自行累计 `dt` 并对照 `MAX_MS[type]` 封顶。`playEffectInBrowser` 的 overlay 生命周期照 mockup `fxOverlay`（cssText 原文照抄，播完 `canvas.remove()`）。mockup 里的 `gen{}` 代次打断机制**不需要**——运行时单飞保证同时只有一个 overlay。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test test/effects.test.ts` → PASS（R16–R27 全绿）；`npx tsc --noEmit` → 无错误。

- [ ] **Step 5: 提交**

```bash
git add src/effects-render.ts test/effects.test.ts
git commit -m "feat(pkg): canvas 粒子引擎与动画播放器（烟花/撒花/下雪）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 输出总入口挂钩（index 接线 + 浏览器行为回归）

**Files:**
- Modify: `src/index.ts`（增 `triggerEffects`；7 处输出入口挂钩）
- Test: `test/effects.test.ts`（追加 fake DOM 脚手架与 R28–R33）

**Interfaces:**
- Consumes: `createEffectsRuntime`/`EffectPlay`（Task 3）、`playEffectInBrowser`（Task 4）、`config.effectOptions()`（Task 1）。
- Produces:
  - `src/index.ts` 私有函数 `triggerEffects(text: string): void`：`IS_PRODUCTION` 或 `config.effectOptions().enabled === false` 时短路；否则 `effectsRuntime.handle(text, config.effectOptions(), playEffectInBrowser)`。模块级 `const effectsRuntime = createEffectsRuntime();`。
  - 挂钩点（全部在**级别过滤之后、console 输出之前**；匹配跑在 `escapeFormat` 之前）：
    | 出口 | 位置 | 匹配文本 |
    |---|---|---|
    | `prettyPrint` | src/index.ts:509，`shouldLog` 后 | `[title, ...parts].join(' ')`，`parts` 为 `text.map(stringify)` 预计算结果（输出循环复用，避免二次 stringify） |
    | `rainbow` | :662 | 复用其 `stringify(text)` 结果 |
    | `group` | :688 | `title` + 各项 stringify（同样预计算复用） |
    | `table` | :737 | `stringify(data)` |
    | `picture` | :759 | **调用时**即匹配 `altText`（不等图片加载） |
    | `timeEnd` | :817 | `label` |
    | `timer` 的 `done` | :864 | `label` |
  - 不挂：`countSummary`（纯返回数据、无控制台输出；其内容经任意日志调用输出时自然参与）、`once` 被吞掉的调用（无输出）、`picture.onerror` 与计时器重复/缺失的 `console.warn`（库诊断，非日志内容）。`once`/`assert`/`withPrefix`/debug/info/error/warning/success 经 `prettyPrint` 自动覆盖。
  - 调用点只在 `config.effectOptions().enabled` 为真时才构造匹配文本（未命中/未开启时开销可忽略）。

- [ ] **Step 1: 写失败测试**（先加 fake DOM 脚手架）

本机库引用统一 `import * as pl from '../src/index.ts'`（`pl.assert` 与 `node:assert` 不撞名），用到的顶层函数可再解构。文件内定义两个测试助手：
- `resetEffects()`：`setEffects({ enabled: true, triggers: { ...DEFAULT_EFFECT_TRIGGERS }, cooldownMs: 2000 });`（各用例 finally 还原默认）
- `installFakeDom({ reducedMotion = false } = {})`：临时替换 `globalThis.window`（含 `devicePixelRatio: 2`、`innerWidth: 800`、`innerHeight: 600`、`matchMedia`）、`globalThis.document`（`createElement('canvas')` 返回假 canvas：`style:{}`、`getContext: () => Proxy 万能 ctx`、`remove` 计数；`body.appendChild` 计数）、`globalThis.Image`（`src` setter 空操作）、`globalThis.requestAnimationFrame`（**同步递归**调用回调、时间戳每次 +16.7、上限 3000 次防死循环——引擎有 MAX_MS 封顶必然收尾）。返回 `{ created, removed, cssText }`（`cssText` 记录对假 canvas `style.cssText` 的赋值原文）；`teardown()` 还原全部全局。

每个用例开头 `setEffects({ cooldownMs: 0 })`（0 冷却让同一用例可连续触发；等值时间戳不构成 `now < cooldownUntil`），用完 finally 里 `resetEffects()`。

```ts
test('R28: 命中时创建全屏 overlay，pointer-events:none，播完移除', () => {
  const dom = installFakeDom();
  try {
    setEffects({ cooldownMs: 0 });
    info('烟花');
    assert.equal(dom.created, 1);
    assert.equal(dom.cssText, 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:99999');
    assert.equal(dom.removed, 1);                    // 同步播完即移除，不留残层
  } finally { dom.teardown(); resetEffects(); }
});

test('R29: 被 logLevel 过滤掉的日志不触发', () => {
  const dom = installFakeDom();
  try {
    setEffects({ cooldownMs: 0 });
    setLogLevel('error');
    info('烟花');
    assert.equal(dom.created, 0);                    // 看不见的日志不该有彩蛋
    error('烟花');
    assert.equal(dom.created, 1);
  } finally { setLogLevel('debug'); dom.teardown(); resetEffects(); }
});

test('R30: 生产环境不触发', async () => {
  const dom = installFakeDom();
  const prev = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const mod = await import(`../src/index.ts?prod=${Date.now()}`);
    mod.info('烟花');                                // R15 的缓存击穿手法
    assert.equal(dom.created, 0);
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prev;
    dom.teardown();
  }
});

test('R31: prefers-reduced-motion 时不创建 canvas', () => {
  const dom = installFakeDom({ reducedMotion: true });
  try {
    setEffects({ cooldownMs: 0 });
    info('烟花');
    assert.equal(dom.created, 0);
  } finally { dom.teardown(); resetEffects(); }
});

test('R32: 所有输出通道的用户内容都参与触发', () => {
  const dom = installFakeDom();
  try {
    setEffects({ cooldownMs: 0 });
    let n = 0;
    const expect = (label: string) => { n += 1; assert.equal(dom.created, n, `${label} 应触发`); };

    info('烟花'); expect('info');
    rainbow('撒花'); expect('rainbow');
    group('庆祝', ['好耶']); expect('group');
    table([{ 备注: '下雪' }]); expect('table');
    picture('u.png', 1, '雪花'); expect('picture');
    time('烟花'); timeEnd('烟花'); expect('timeEnd');
    timer('撒花', (done) => { done(); }); expect('timer');
    once(`r32-${Date.now()}`, '好耶'); expect('once');
    assert.throws(() => pl.assert(false, '下雪')); expect('assert 失败信息');
  } finally { dom.teardown(); resetEffects(); }
});

test('R33: 无 DOM 下全链路调用不抛错', () => {
  assert.doesNotThrow(() => { pl.info('烟花'); });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test test/effects.test.ts` → FAIL，R28 的 `dom.created` 为 0（挂钩未实现）。

- [ ] **Step 3: 实现挂钩**

按 Interfaces 表逐点接入 `triggerEffects`；`prettyPrint`/`group` 把循环内的 `stringify` 提到循环外预计算并复用（行为不变，只是不算两遍）。`triggerEffects` 内部再查一次 `enabled`（防御未来新出口漏查）。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test test/effects.test.ts` → PASS（R16–R33 全绿）；`npx tsc --noEmit` → 无错误。

- [ ] **Step 5: 提交**

```bash
git add src/index.ts test/effects.test.ts
git commit -m "feat(pkg): 日志输出挂钩触发词动画，覆盖全部输出通道

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: 演示页、README 与全量验证

**Files:**
- Modify: `test/test.html`
- Modify: `README.md`、`README.zh-CN.md`

**Interfaces:**
- Consumes: 公开 API 全集（Task 1–5 产出）。
- Produces: 无新代码接口；交付演示与文档。

- [ ] **Step 1: `test/test.html` 增「触发词彩蛋」演示区**

三个按钮分别 `info('烟花')`、`info('撒花')`、`info('下雪')`（单击各自触发一次，可感受冷却）；一个「关闭彩蛋」开关按钮调 `setEffects({ enabled: false })`/`{ enabled: true }`；一行说明文字（提示：连续触发只播一次，播完约 2 秒冷却）。

- [ ] **Step 2: README.md / README.zh-CN.md 各增「触发词动画（彩蛋）」小节**

内容：默认词表表格（六词三动画）、配置示例（用确切 API：`import { configure, setEffects, DEFAULT_EFFECT_TRIGGERS } from '@wb04307201/pretty-log'`，示例含 `setEffects({ triggers: { ...DEFAULT_EFFECT_TRIGGERS, '好耶': 'confetti' } })` 与一键关闭 `setEffects({ enabled: false })`）、两行说明（production 与 `prefers-reduced-motion` 下不播）。

- [ ] **Step 3: 全量验证**

Run: `npx tsc --noEmit` → 无错误。
Run: `yarn test:unit:offline` → 全绿（R1–R33 及既有用例）。
Run: `yarn build` → `dist/main.js`、`dist/module.js`、`dist/types.d.ts` 三产物齐全，且 `types.d.ts` 含 `EffectType`、`EffectsOptions`、`DEFAULT_EFFECT_TRIGGERS`、`setEffects`、`getEffects`。

- [ ] **Step 4: 手动视觉检查**

Run: `yarn test`，浏览器打开演示页，点三个按钮肉眼对照 mockup：火箭升空炸开、纸屑打转飘落、雪花斜飘——**形态不许走样**；播放期间页面按钮照常可点。

- [ ] **Step 5: 提交**

```bash
git add test/test.html README.md README.zh-CN.md
git commit -m "docs(pkg): 触发词动画演示页与 README 说明

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
