# 表格美化与整套配色设计（table + palette）

- 日期：2026-11-13
- 状态：设计定案（视觉三屏逐轮选定 + 审查代理复核 + theme API 职责分离），待实现计划
- 起因：美化 `prettyLog.table`（参考腾讯云 [so/111547335](https://cloud.tencent.com/developer/ask/sof/111547335)，即 SO q/27290486 的镜像）+ info/warn/rainbow 整套默认配色重设

## 意图

pretty-log 的立身之本是「好看的 console.log」。当前两处失分：

1. `table()`（src/index.ts）是裸 `console.table(data)`——原生表**无法样式化**（`%c` 参数对它无效，SO q/27290486 共识），在「好看」上交白卷。
2. 默认配色是逐功能长出来的，不成体系：徽章白字压浅色块对比度仅 ≈2:1；`rainbow` 用裸 CSS 颜色名 + 白字压黄底不可读，且与柔和色板打架；浅色控制台下文字对比度不足（README 已注明 caveat）。

调研补充：浏览器 `%c` 美化表格生态位是空的——console-table-printer（227★）源码着色全是 ANSI 转义（`colored-console-line.js`，0 处 `%c`），是终端方案；DevTools Custom Formatters 可行但仅 Chrome/Edge、默认关、协议重。结论：**自绘 `console.log` + `%c` 文本表格**是唯一既自由又通用的路线。

用户明确：**好看优先，原生交互只当逃生口**（降级开关保底，但默认体验完全按视觉设计走）。

## 目标

- G1 `table()` 输出自绘 `%c` 美化表格：组外壳 + 斑马纹 + 类型着色 + CJK 双宽对齐。
- G2 一套完整默认配色：级别徽章、组外壳、表格、rainbow，深/浅控制台双版本。
- G3 徽章对比度达标（深色字压色块，≈9:1）。
- G4 保留降级通道：需要原生表交互（列排序、对象展开）时可切换。

## 非目标

- DevTools Custom Formatters（Chrome-only、默认关、协议重）。
- 自动跟随 DevTools 主题（**页面 JS 无法检测 DevTools 主题**，做不到）。
- `once`/`count`/`timer`/`picture` 等其它 API 行为变更。
- 超宽表的完美布局（交给控制台滚动/折行）。

## 反目标

- 不为保原生交互在默认视觉上让步。
- 零运行时依赖。
- 除 theme API 按 D3 职责分离重做（允许 breaking）外，其余公开 API 不破坏（只增不改）。

## 约束

- 样式只能经 `%c` 内联样式实现；对齐靠空格填充。
- 显示宽度：CJK（≥ U+2E80）= 2，其余 = 1。mockup 阶段实测 Chrome 13px Consolas 系字体下各行宽度偏差 < 1px。
- `IS_PRODUCTION` 时全部 no-op（含表格渲染）。
- 级别过滤、`escapeFormat`（`%` → `%%`）、history 存快照等既有行为保持。
- TDD、RED-first；Node 内置 test runner；`test/**` 先行。
- `npx tsc --noEmit` 通过（strict）。

## 已定决策（用户逐轮拍板）

### D1 表格结构：B 斑马韵律 + B2 类型着色

（mockup 屏 1「A 线框 / B 斑马 / C 报表横线」选 B；屏 2「B1 亮表头 / B2 类型着色 / B3 蓝调斑马 / B4 呼吸留白」选 B2）

- 无边框；隔行淡底色：深底 `rgba(255,255,255,0.055)`，浅底 `rgba(0,0,0,0.05)`。
- 类型着色：数值 = warning 色（深底 `#fde68a` / 浅底 `#b45309`）；null = 灰（`#8b93a7` / `#6b7280`）；字符串 = 正文色（`#e8eaed` / `#3c4043`）。
- 数字列右对齐（含 id、score 判定为数值的列）；表头加粗（`#ffffff` / `#202124`）。
- 组外壳常驻：`▾ [表名] N 行 × M 列`；标题徽章 = accent 填充 + 深色字（同 D3 徽章处理），meta 灰字（`#8b93a7` / `#5f6368`）。

### D2 配色：P1 柔雾低饱

> Amendment (2026-11-13): 默认 mode 改为环境自适应（prefers-color-scheme，无 matchMedia 回退 light），用户裁定白底优先，覆盖本文「默认 dark」。

（mockup 屏 3「P1 柔雾低饱 / P2 现状改良 / P3 鲜明跳脱」选 P1；屏 4 确认浅底适配版同样成立）

深底（默认）值：

| 值 | 用途 |
|---|---|
| `#a5b4fc` | debug |
| `#93c5fd` | info、time、accent（组外壳/表名徽章填充） |
| `#86efac` | success |
| `#fde68a` | warning、表格数值 |
| `#fca5a5` | error |
| `#c4b5fd` | group |
| `#8b93a7` | null、meta |
| `#1f2330` | 徽章文字（压色块） |
| `#e8eaed` | 正文/表格字符串 |

浅底文字变体（只换直接压在控制台底色上的值）：

| 值 | 用途 |
|---|---|
| `#6366f1` | debug |
| `#2563eb` | info、time |
| `#15803d` | success |
| `#b45309` | warning、表格数值 |
| `#dc2626` | error |
| `#6d28d9` | group |
| `#6b7280` | null |
| `#5f6368` | meta |
| `#3c4043` | 正文/表格字符串 |

**两底通用**（自带底色、不随 mode 变）：全部徽章填充色（含 accent）、rainbow 渐变条。

- 徽章文字统一 `badgeText: '#1f2330'` 深色压色块（≈9:1），修掉现在白字 ≈2:1 的毛病；不随 mode 变、不做填充亮度自动翻转（深色自定义填充需自设 `badgeText`，README 注明）。
- rainbow：`#f9a8d4 → #c4b5fd → #93c5fd → #6ee7b7 → #fde68a`，文字 `#23273a`（顺带修掉白字压黄底）。

### D3 主题 API：(c) 职责分离（用户拍板，允许 breaking）

结构（`configure({ theme })` 同形）：

```ts
setTheme({
  mode: 'light',            // 只搬动未被用户覆盖的预设值
  badgeText: '#1f2330',     // 徽章文字，全局一枚，两底通用
  fills: { /* 徽章填充（含 accent），两底通用 */ },
  texts: { /* 文字色 */ },
})
```

- 键集合：`fills` = debug/info/success/warning/error/group/accent；`texts` = debug/info/success/warning/error/group/time/null/meta/body。表格数值色 = `texts.warning`、空值 = `texts.null`、字符串 = `texts.body`（不另开键）；rainbow 独立键组（渐变 stops + 文字色）。
- 默认值 = D2 的 P1 两套；`mode`（`'dark' | 'light'`，默认 `'dark'`）只切换**未被用户覆盖**的预设值。
- 用户覆盖语义：`fills`/`texts` 设了就是用户的，跨 mode 保留（自定义色在浅底上可读性由用户自己负责）；`texts` 覆盖为单值、两 mode 同值，分 mode 的 nested 形态（`texts: { info: { dark, light } }`）留待有需求再加（YAGNI）。
- **旧平铺键（`infoColor`、`groupColor`、`titleColor` 等）移除**，发 breaking 版本；README 一行迁移对照（如 `infoColor` → `fills.info` + `texts.info`）。
- 切换与覆盖在**调用时**生效（与现有语义一致：颜色按调用时读取，不模块加载时捕获）。

### D4 表格输出模式

- `setTableMode('pretty' | 'native')`，默认 `'pretty'`；`configure({ tableMode })` 同步支持。
- `'pretty'`：组外壳 + 自绘表格。
- `'native'`：组外壳不变，内芯换原生 `console.table`（列排序、对象展开、复制等交互保留）。
- 输入形状：
  - `object[]`：列 = 各行键的并集，按首现顺序；
  - `array[]`：列 = 索引（0..maxLen-1）；
  - 空数组：空表，`0 行 × 0 列`；
  - **其它形状（单对象、原始值、Map/Set 等）自动走 native 兜底**（外壳照旧）。
  - 单元格取值走现有 `stringify`（循环引用安全、Error/Map/Set 有意义格式）。

## 我的默认值（已向用户声明，可否决）

- 单元格内容宽 24 显示列截断，`…` 占 1 列（宽度计入 CJK=2 规则）；history 存全量 stringify 快照不受截断影响。
- 列内边距 1 空格、列间 2 空格；行数不限（长表靠组外壳折叠语义缓解，折叠行为沿用 `group` 现状）。
- `table(data, title?)` 新增可选第二参，默认 `'Table'`；`withPrefix` 的 logger 表名按现有前缀规则拼接。

## 审查代理复核后的裁定（builder-check，可否决）

设计文档交独立审查代理通读后，以下两处细节由我裁定（与 mockup 呈现一致），不同意可改：

- **数值判定**：着色按单元格——原始值为 `number`、或字符串化后形如数字（如 `'92.5'`）→ 数值色；`null`/`undefined` → null 色；其余 → 字符串色。对齐按列——非空单元格全为数值的列右对齐（含该列表头），混列整体左对齐。
- **形状分支补全**：全原始值数组（如 `string[]`/`number[]`）→ 单列 `(value)` pretty 表；全对象数组 → 键并集列，**不带索引列**（与 mockup 一致）；全数组数组 → 索引列；其余（混形状数组、单对象、原始值、Map/Set 等）→ native 兜底，外壳照旧。

## 留给实现计划 / Builder

- `Theme` / `ConfigManager` 按 D3 重做：`DEFAULT_THEME_DARK` / `DEFAULT_THEME_LIGHT` 两预设 + `fills`/`texts`/`badgeText`/`mode` 覆盖层；TS 类型形状与 `configure` 合并策略（fills/texts 各自浅合并即可）留给实现计划。
- 表格渲染器落点：`prettyPrint` 加分支还是新 `renderTable`（都必须复用 `escapeFormat`、宽度计算、级别过滤、history）。
- 宽度函数对 emoji（代理对）、组合字符的策略：建议代理对按 2、组合字符按 0，宁可保守。
- `setTableMode` 与 `withPrefix` logger 的组合形态。
- 测试矩阵（按仓库 TDD/RED-first 惯例）在 plan 里细化；核心用例：宽度计算、截断、对齐、类型着色映射、fills/texts 覆盖优先与跨 mode 保留、badgeText 独立生效、mode 切换调用时生效、native 降级与形状兜底、生产剥离。
- README.zh-CN.md / README.md 的 theme-compare caveat 需随本设计更新（浅底不再只是「有所下降」，有正式适配），并补旧键迁移对照（`infoColor` → `fills.info` + `texts.info` 等）；发版按 breaking 升版（major，0.x 则 minor），触发流程照旧走 RELEASING.md。
