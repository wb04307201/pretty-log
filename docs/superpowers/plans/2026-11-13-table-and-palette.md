# 表格美化与整套配色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `table()` 输出自绘 `%c` 美化表格（斑马纹 + 类型着色 + CJK 双宽对齐），默认配色整体换成 P1 柔雾低饱并提供深浅双套与 `setTableMode('native')` 降级逃生口。

**Architecture:** 在 `src/index.ts` 内把 `Theme` 重做为职责分离结构（`fills` 徽章填充 / `texts` 文字 / `badgeText` / `mode`），全部输出函数按角色取色；`table()` 增加自绘渲染引擎（空格对齐 + `%c` 样式），`console.group` 做组外壳，形状不适用或 `setTableMode('native')` 时内芯回退原生 `console.table`。测试新增 `test/theme.test.ts` 与 `test/table.test.ts`，`core`/`features` 的旧主题键用例同步迁移。

**Tech Stack:** TypeScript（strict，ES2015 target），Node 内置测试（`node:test` + `node:assert/strict`），Parcel 构建；零运行时依赖。

**Spec:** `docs/superpowers/specs/2026-11-13-table-and-palette-design.md`

## Global Constraints

- 零运行时依赖；`npx tsc --noEmit` 必须通过（strict）。
- `IS_PRODUCTION`（`NODE_ENV=production`）时一切输出 no-op，含表格渲染。
- 用户内容必须经 `escapeFormat`（`%` → `%%`）才能拼进 `%c` 模板串；触发词匹配保持在转义前（现状不变）。
- 显示宽度：CJK（≥ U+2E80）= 2，代理对 = 2，组合字符 = 0，其余 = 1。
- TDD、RED-first：每任务先写失败测试再实现；单测 `node --experimental-strip-types --test test/<file>.ts`，全量 `yarn test:unit:offline`，类型 `npx tsc --noEmit`。
- 除 theme API（breaking）外公开 API 只增不改：`setStyles({ titleColor })` 继续有效（与 `badgeText` 同槽，见 Task 1）。
- 提交信息中文 conventional 前缀，收尾 `Co-Authored-By: Claude Code <noreply@anthropic.com>`；不 push。

## Review Focus

1. 表格单元格/标题含 `%c`/`%s`/`%` 的输入不得错位样式实参（所有拼接点都过 `escapeFormat`）→ Task 2 `table.test.ts` 含 `%` 注入用例。
2. CJK/emoji/超宽内容的列对齐与截断（24 显示列截断、`…` 占 1 列、各列等宽）→ Task 2 宽度用例（张三 vs Alice、emoji、超长串）。
3. 主题覆盖语义：用户覆盖跨 mode 保留、`undefined` 恢复默认、颜色在调用时读取（老 R1 回归不倒退）→ Task 1 `theme.test.ts` + 重写 R1。
4. 形状边缘不抛错且路由正确：空数组、缺键行、null/undefined 值、循环引用、混形状/单对象/Map/Set → native 兜底 → Task 2 形状用例。
5. 生产剥离与迁移完整性：production 下 table 全静默；core/features 旧主题键用例迁移后全绿、tsc 过 → Task 3 生产用例 + Task 1 迁移。

## 文件结构

- `src/index.ts` — 全部改动落点（沿用单文件惯例）：Theme 类型与 P1 双预设、ConfigManager 覆盖层、宽度/截断/形状分类工具、`renderTable`、各输出函数调色迁移、`table`/`setTableMode`/`withPrefix.table`。
- `test/theme.test.ts`（新建）— D3 主题语义。
- `test/table.test.ts`（新建）— D1/D4 表格渲染。
- `test/core.test.ts`、`test/features.test.ts` — 迁移旧主题键与 `reset()` 助手、更新 R8 历史断言。
- `README.md`、`README.zh-CN.md`、`CLAUDE.md`、`RELEASING.md` — 文档同步（Task 4）。

---

### Task 1: 主题模型重做（Theme / ConfigManager / 调色迁移）

**Files:**
- Modify: `src/index.ts`（Theme/DEFAULT_THEME、DEFAULT_STYLES.titleColor、ConfigManager、buildBoxStyle、makeLogger、withPrefix、prettyPrint、rainbow、group、timeEnd、timer、once、ConfigOptions、configure、setTheme/setStyles）
- Create: `test/theme.test.ts`
- Modify: `test/core.test.ts`、`test/features.test.ts`（旧主题键迁移）

**Interfaces:**

- Consumes: 无（首个任务）。
- Produces:

```ts
export type ThemeMode = 'dark' | 'light';

export interface ThemeFills {
  debug: string; info: string; success: string; warning: string; error: string;
  group: string; accent: string;
}

export interface ThemeTexts {
  debug: string; info: string; success: string; warning: string; error: string;
  group: string; time: string; null: string; meta: string; body: string;
}

export interface RainbowTheme { colors: string[]; text: string }

export interface Theme {
  mode: ThemeMode;
  badgeText: string;
  fills: ThemeFills;
  texts: ThemeTexts;
  rainbow: RainbowTheme;
}

export interface ThemeUpdate {
  mode?: ThemeMode;
  badgeText?: string | undefined; // undefined = 恢复默认
  fills?: { [K in keyof ThemeFills]?: string | undefined };
  texts?: { [K in keyof ThemeTexts]?: string | undefined };
  rainbow?: { colors?: string[]; text?: string | undefined };
}

type LevelRole = 'debug' | 'info' | 'success' | 'warning' | 'error'; // 内部

export const setTheme = (partial: ThemeUpdate): void => { /* ... */ };
export const getTheme = (): Theme => { /* ... */ };      // 新增
export const resetTheme = (): void => { /* ... */ };     // 新增：清空覆盖 + mode='dark'
// configure({ theme?: ThemeUpdate, ... })；setStyles 不变
```

P1 预设常量（值必须逐字使用）：

- `P1_FILLS`：debug `#a5b4fc`、info `#93c5fd`、success `#86efac`、warning `#fde68a`、error `#fca5a5`、group `#c4b5fd`、accent `#93c5fd`
- `P1_BADGE_TEXT`：`#1f2330`
- `P1_RAINBOW`：colors `['#f9a8d4', '#c4b5fd', '#93c5fd', '#6ee7b7', '#fde68a']`、text `#23273a`
- `P1_TEXTS_DARK`：debug `#a5b4fc`、info `#93c5fd`、success `#86efac`、warning `#fde68a`、error `#fca5a5`、group `#c4b5fd`、time `#93c5fd`、null `#8b93a7`、meta `#8b93a7`、body `#e8eaed`
- `P1_TEXTS_LIGHT`：debug `#6366f1`、info `#2563eb`、success `#15803d`、warning `#b45309`、error `#dc2626`、group `#6d28d9`、time `#2563eb`、null `#6b7280`、meta `#5f6368`、body `#3c4043`
- fills/rainbow/badgeText 两 mode 共用；texts 按 mode 取。

内部签名变更：

- `buildBoxStyle(fill: string, textColor: string, isTitle: boolean): string` — 标题段 `background:fill` + 边框 fill + `color:badgeText`；内容段边框与文字用 textColor。几何参数（padding/borderWidth 等）沿用 `Styles`。
- `makeLogger(defaultTitle: string, role: LevelRole, level: LogLevel)` — 调用时解析 `fills[role]`/`texts[role]`（不再传 `keyof Theme` 与 fallback hex）。
- `prettyPrint(title: string, text: LogContent[], colors: { fill: string; text: string }, level?: LogLevel, context?: string)`。
- `badgeText` 单存储槽：`DEFAULT_STYLES.titleColor` 默认值改为 `#1f2330`，`setStyles({ titleColor })` 与 `setTheme({ badgeText })` 读写同一槽，两者 `undefined` 均恢复 `#1f2330`。
- `timeEnd`/`timer` 输出改两段：徽章段（`titlePrefix + label`，`fills.accent` 背景 + `badgeText` 字）+ 内容段（`xx.xxms`，`texts.time` 字）；`timeEnd(label, color?)` 的 `color` 仍整段覆盖（兼容）。
- `group`：`fills.group` 背景 + `badgeText` 字（替换硬编码白字），内容行 `texts.group`；`color?` 参数同上整段覆盖。
- `rainbow`：渐变 `theme.rainbow.colors.join(', ')`，文字 `theme.rainbow.text`。
- `once`：走 `fills.info`/`texts.info`。

- [ ] **Step 1: 写失败测试 `test/theme.test.ts`**

用例（`reset()` 助手内部用 `prettyLog.resetTheme()`）：

1. `getTheme() 默认返回 P1 dark 全套值` — `assert.equal(t.mode, 'dark')`、`t.fills.info === '#93c5fd'`、`t.fills.accent === '#93c5fd'`、`t.texts.body === '#e8eaed'`、`t.texts.warning === '#fde68a'`、`t.badgeText === '#1f2330'`、`t.rainbow.colors` 逐项等于五色数组、`t.rainbow.text === '#23273a'`
2. `fills/texts 局部覆盖，未提及键不动` — `setTheme({ fills: { info: '#00FF00' } })` 后 `fills.info === '#00FF00'` 且 `fills.error === '#fca5a5'`
3. `mode 切换只搬动未覆盖键` — 默认下 `setTheme({ mode: 'light' })` → `texts.info === '#2563eb'`、`texts.warning === '#b45309'`；再 `setTheme({ texts: { info: 'red' }, mode: 'dark' })` 后 `texts.info === 'red'`、`texts.warning === '#fde68a'`（覆盖跨 mode 保留）
4. `覆盖项传 undefined 恢复默认` — 覆盖后 `setTheme({ fills: { info: undefined } })` → `fills.info === '#93c5fd'`
5. `badgeText 与 styles.titleColor 同槽` — `setStyles({ titleColor: 'gold' })` → `getTheme().badgeText === 'gold'`；`setTheme({ badgeText: 'silver' })` → 输出样式含 `silver`；`setTheme({ badgeText: undefined })` → `' #1f2330 '`
6. `resetTheme 清空覆盖并回到 dark`
7. `configure({ theme }) 与 setTheme 等价合并`
8. `调用时取色（R1 回归）` — `setTheme({ fills: { info: '#00FF00' } })` 后 `info('标题','内容')` 的捕获样式含 `background:#00FF00`

- [ ] **Step 2: 运行确认失败**

Run: `node --experimental-strip-types --test test/theme.test.ts`
Expected: FAIL（`getTheme`/`resetTheme` 未导出、Theme 形状不符）

- [ ] **Step 3: 实现主题模型并迁移全部调色点**

按上面 Interfaces 重做 `src/index.ts`：删 `DEFAULT_THEME` 与旧 `Theme` 平铺键，上 P1 预设与覆盖层（`get theme()` 按 mode 拼预设+覆盖）；逐个迁移 `buildBoxStyle`/`makeLogger`/`withPrefix`/`prettyPrint`/`rainbow`/`group`/`timeEnd`/`timer`/`once` 的取色；同步迁移 `test/core.test.ts`（R1 断言改新键）与两文件的 `reset()` 助手（改用 `resetTheme()`）。

- [ ] **Step 4: 运行全部测试与类型检查确认通过**

Run: `node --experimental-strip-types --test test/theme.test.ts test/core.test.ts test/features.test.ts` 然后 `npx tsc --noEmit`
Expected: PASS、0 failures

- [ ] **Step 5: Commit**

```bash
git add src/index.ts test/theme.test.ts test/core.test.ts test/features.test.ts
git commit -m "feat(pkg): 主题 API 职责分离，P1 双预设与 fills/texts/badgeText/mode 覆盖层

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 自绘表格核心（renderTable + 全形状 + 组外壳）

**Files:**
- Modify: `src/index.ts`（新增宽度/截断/形状分类工具与 `renderTable`；`table()` 改造）
- Create: `test/table.test.ts`
- Modify: `test/features.test.ts`（R8 历史断言更新：history 内容改为未截断全量文本、title 改为表名）

**Interfaces:**

- Consumes: Task 1 的 `getTheme()`/`theme.texts.*`/`theme.fills.accent`/`theme.badgeText`/`theme.mode`。
- Produces:

```ts
type TableShape = 'empty' | 'objects' | 'arrays' | 'primitives' | 'native'; // 内部
const displayWidth = (s: string): number;          // 内部，规则见 Global Constraints
const padCell = (s: string, width: number, align: 'left' | 'right'): string; // 内部
const truncateCell = (s: string, max: number): string; // 内部：>max 截到 max-1 显示列 + '…'
const classifyTableShape = (data: unknown): TableShape; // 内部
const renderTable = (title: string, data: unknown): void; // 内部，前置守卫已由 table() 过

export const table = (data: unknown, title: string = 'Table'): void;
```

渲染规则（值逐字使用）：

- 形状分类：空数组 → `empty`；全为非 null 对象且非数组 → `objects`；全为数组 → `arrays`；全为原始值（含 null/undefined 元素）→ `primitives`；其余（混形状、单对象、Map/Set、原始值 data 本身）→ `native`。
- 列定义：`objects` = 各行键并集（首现顺序），缺键格显示空文本（无类型色）；`arrays` = 索引列 `0..maxLen-1`；`primitives` = 单列 `(value)`；`empty` = 只输出组外壳（`0 行 × 0 列`），无表头。
- 单元格文本 = `truncateCell(stringify(原始值), 24)`；列宽 = 表头/单元格显示宽度最大值。
- 行数不限（不做分页/截行；长表靠组外壳折叠缓解，折叠沿用 `group` 现状语义）。
- 类型着色（按格）：原始值 `typeof number` 或文本匹配 `/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/` → `texts.warning`；原始值 null/undefined → `texts.null`；其余 → `texts.body`。
- 列对齐：非空值全为数值且至少一个非空值的列 → 右对齐（含表头）；否则左对齐。
- 行格式：每行一次 `console.log`，格文本 = `' ' + padCell(...) + ' '`，格间 gutter `'  '`（末格无）；每格一个 `%c` 段，样式 = 斑马背景（可选）+ 类型色。
- 斑马：数据行 i（0 起）`i % 2 === 0` 加背景 `rgba(255,255,255,0.055)`（dark）/ `rgba(0,0,0,0.05)`（light，按 `theme.mode` 取）。
- 表头：加粗，色 `#ffffff`（dark）/ `#202124`（light）。
- 组外壳：`console.group('%c <标题> %c <N 行 × M 列>', pillStyle, metaStyle)`，pillStyle = `background:fills.accent;color:badgeText;font-weight:600`，meta 段 = `texts.meta`；`try { ... } finally { console.groupEnd() }`。非数组输入（native 兜底）省略计数段。不加字面 `▾`（DevTools 自带折叠箭头）。
- `native` 形状与 `'native'` 模式（Task 3）：组外壳内 `console.table(data)` 原样输出。
- history：title = 表名；content = `[未截断的全量纯文本（表头+各行，'\n' 连接）]`。
- `table()` 保留前置守卫：`IS_PRODUCTION`、`shouldLog('info')`、`triggerEffects(stringify(data))`。

- [ ] **Step 1: 写失败测试 `test/table.test.ts`**

用例（`capture` 助手沿用 `features.test.ts` 手法，覆盖 log/group/groupEnd/table）：

1. `object[]：键并集列、首现顺序、5 行 × 4 列` — 固定 5 行（id/name/score 交错键）数据，断言组标签含 `5 行 × 4 列`、表头行含 `id` `name` `role` `score`
2. `类型着色` — 数字格样式含 `#fde68a`、null 格含 `#8b93a7`、字符串格含 `#e8eaed`；`setTheme({ texts: { warning: '#00FF00' } })` 后数字格含 `#00FF00`
3. `数值列右对齐、混列左对齐` — score 列单元格文本按右对齐拼版（断言行内空格分布），role 列左对齐
4. `CJK 等宽对齐` — 行含 `张三` 与 `Alice`，断言各行截去样式后总显示宽度相等
5. `截断` — 30 显示列长串显示为 23 列 + `…`；history 内容含完整原串
6. `array[] → 索引列`；`全原始值 → 单列 (value)`（含 null 元素着 `#8b93a7`）
7. `空数组 → 组外壳 0 行 × 0 列，无表头`
8. `native 兜底` — `table({a:1})`、`table(new Map([['k','v']]))`、`table([{}, [1]])` 三种均 `console.table` 被调用且组外壳存在
9. `% 注入` — 单元格含 `%c`/`%s` 时每行实参数量等于 `%c` 段数
10. `循环引用对象` — 行值含 `[Circular]` 文本、不抛错
11. `斑马` — 第 1、3 个数据行样式含 `rgba(255,255,255,0.055)`，第 2 个不含；`setTheme({ mode: 'light' })` 后含 `rgba(0,0,0,0.05)`
12. `级别过滤` — `setLogLevel('error')` 后 `table(...)` 零输出

- [ ] **Step 2: 运行确认失败**

Run: `node --experimental-strip-types --test test/table.test.ts`
Expected: FAIL（`table` 仍为裸 `console.table`、第二参数不存在）

- [ ] **Step 3: 实现 renderTable 与工具**

按上面渲染规则实现（含 `escapeFormat` 覆盖所有拼接点、`displayWidth` 代理对/组合字符策略）；`table()` 改造为守卫 + `renderTable(title, data)`；同步更新 `features.test.ts` 的 R8 历史断言。

- [ ] **Step 4: 运行全部测试与类型检查确认通过**

Run: `node --experimental-strip-types --test test/table.test.ts test/features.test.ts test/core.test.ts` 然后 `npx tsc --noEmit`
Expected: PASS、0 failures

- [ ] **Step 5: Commit**

```bash
git add src/index.ts test/table.test.ts test/features.test.ts
git commit -m "feat(pkg): table 自绘美化表格，斑马纹/类型着色/CJK 对齐与全形状渲染

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: setTableMode 降级开关 + withPrefix.table + 生产剥离

**Files:**
- Modify: `src/index.ts`（`TableMode`、`setTableMode`、`ConfigOptions.tableMode`、`configure`、`withPrefix` 返回值加 `table`）
- Modify: `test/table.test.ts`（追加用例）

**Interfaces:**

- Consumes: Task 2 的 `renderTable`/`table` 与组外壳形态。
- Produces:

```ts
export type TableMode = 'pretty' | 'native';
export const setTableMode = (mode: TableMode): void => { /* ... */ };
// configure({ tableMode?: TableMode })；默认 'pretty'
// withPrefix(prefix) 返回值新增 table: (data: unknown, title?: string) => void，
// 标题按现有规则拼接为 `[${prefix}] ${title}`
```

- [ ] **Step 1: 写失败测试（追加到 `test/table.test.ts`）**

1. `setTableMode('native') → console.table 被调用、无自绘行、组外壳计数仍在` — `table([{a:1},{a:2}])` 断言 `cap.table` 非空、`cap.log` 无数据行
2. `默认 'pretty'` — object[] 输入 `cap.table` 为空
3. `configure({ tableMode: 'native' })` 与 `setTableMode` 等价；`setTableMode('pretty')` 可切回
4. `withPrefix('X').table(data, 'T')` — 组标签含 `[X] T`
5. `生产剥离` — 沿用 `features.test.ts` R15 的手法（子进程 `NODE_ENV=production`）断言 `table()`/`setTableMode()` 零输出

- [ ] **Step 2: 运行确认失败**

Run: `node --experimental-strip-types --test test/table.test.ts`
Expected: 新用例 FAIL（`setTableMode` 未导出）

- [ ] **Step 3: 实现**

`ConfigManager` 加 `_tableMode` 与读写；`renderTable` 按模式决定内芯（pretty 自绘 / native `console.table`）；`withPrefix` 返回对象加 `table`。

- [ ] **Step 4: 运行全部测试与类型检查确认通过**

Run: `yarn test:unit:offline` 然后 `npx tsc --noEmit`
Expected: PASS、0 failures

- [ ] **Step 5: Commit**

```bash
git add src/index.ts test/table.test.ts
git commit -m "feat(pkg): setTableMode 原生降级开关与 withPrefix.table

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 文档同步与全量验证

**Files:**
- Modify: `README.zh-CN.md`、`README.md`、`CLAUDE.md`、`RELEASING.md`

- [ ] **Step 1: README.zh-CN.md / README.md**

- theme-compare 浅底 caveat 替换为 `setTheme({ mode: 'light' })` 正式说明（深浅双套）。
- 主题 API 文档：`Theme`/`ThemeUpdate` 形状、`setTheme`/`getTheme`/`resetTheme`、`badgeText` 与 `setStyles({ titleColor })` 同槽说明。
- 迁移对照表：`infoColor` → `fills.info` + `texts.info`，`errorColor` → `fills.error` + `texts.error`，`warningColor` → `fills.warning` + `texts.warning`，`successColor` → `fills.success` + `texts.success`，`debugColor` → `fills.debug` + `texts.debug`，`groupColor` → `fills.group` + `texts.group`，`timeColor` → `fills.accent` + `texts.time`；标注 breaking。
- `table(data, title?)` 与 `setTableMode('pretty'|'native')` 新文档段（含逃生口说明）。

- [ ] **Step 2: CLAUDE.md / RELEASING.md**

CLAUDE.md 架构段同步（Theme 结构、table 渲染、新增测试文件）；RELEASING.md 注记 breaking 升版（`npm version major`，0.x 则 minor），触发流程照旧。

- [ ] **Step 3: 手动视觉核对**

Run: `yarn test` 打开 `test/test.html`，用模拟面板黑白主题切换目检：深/浅两底下徽章对比度、表格斑马/对齐/截断、rainbow、time 两段式。

- [ ] **Step 4: 全量验证**

Run: `yarn test:unit:offline && npx tsc --noEmit && yarn build`
Expected: 全绿，`dist/` 产物生成

- [ ] **Step 5: Commit**

```bash
git add README.zh-CN.md README.md CLAUDE.md RELEASING.md
git commit -m "docs(pkg): README/CLAUDE/RELEASING 同步主题迁移与表格新特性

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
