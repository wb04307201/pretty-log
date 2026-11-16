# 下雨/打雷 触发词动画扩展 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 触发词动画新增 rain（下雨）与 lightning（打雷）两种粒子效果，默认词表扩为天气+吐槽两族共 16 词（坏消息优先命中）。

**Architecture:** `src/effects.ts` 只扩类型与默认词表；两台新粒子 maker 追加进 `src/effects-render.ts`（rain=直线斜落雨丝，lightning=中点位移折线+全屏闪白），复用既有 `createEffectEngine` 封顶与 `playEffectInBrowser` overlay 生命周期；`src/index.ts` 仅放行新类型并更新告警文案。挂钩、防轰炸、匹配语义零改动。

**Tech Stack:** TypeScript strict（零依赖）、Node 内置 test runner、Parcel 构建、yarn。

**Spec:** `docs/superpowers/specs/2026-11-12-rain-lightning-design.md`（执行者须先读；spec 是裁决权威，本计划是它的展开）

## Global Constraints

- 零依赖；`src/` 模块顶层零 DOM 访问（Node 导入安全）
- `NODE_ENV=production` 与 `prefers-reduced-motion: reduce` 全部 no-op（新词/新效果同样适用）
- 时长封顶：rain ≤ 6000ms（目标 4-5s 自然收）、lightning ≤ 3000ms（目标 2s 内自然收）；MAX_MS 值与 mockup 注释保持一致
- 防轰炸语义不变：全局单飞 + 播完起算 2s 冷却；一条日志只播一个动画；跨效果种类互斥
- 匹配语义不变：子串匹配、键 ≥2 字符、英文大小写敏感、键插入序即命中优先级
- `src/` 内相对导入带 `.ts` 后缀（如 `./effects.ts`）
- 测试用 Node 内置 runner，新用例全部写进 `test/effects.test.ts`（已在 `test:unit:offline` 显式清单，`package.json` 无需改）；R 编号自 R35 续（R16 是随词表变更的既有用例，只改期望值不改编号）
- 默认词表拒收词（不得回潮）：完了、没了、裂开、崩了、炸了、单字"雷"、裸"翻车"
- mockup 形态纪律：参数可微调，形态走样不行；新建 `docs/superpowers/specs/2026-11-12-rain-lightning-mockup.html`，v1 mockup（2026-11-11-…）只读不动
- 提交信息中文 + conventional prefix，结尾附 `Co-Authored-By: Claude Code <noreply@anthropic.com>`

## Review Focus

形态与观感是本功能的验收面，单测只钉行为；以下五项最易溜走，评审重点看：

1. **lightning 在浅色页面上的可见性**——白芯容易被白底吞掉，深色底衬必须在（对照 mockup 的深浅双底板）→ Task 3 截图步钉（浅底/深底各一张）
2. **rain 斜线方向恒定、无摆动**——不得把 Snowflake 的摆动代码带进来（sway 摆动/尾迹/水花都是走样）→ Task 2 截图步对照 mockup + 代码里不得出现 `Math.sin` 摆动项
3. **「芭比q了」小写变体不得误触发**——英文大小写敏感是既定语义 → R36 断言 `matchEffect('芭比q了', …) === null`
4. **README 示例词必须真实有效**——v1 曾用过不触发的示例词（'好耶' 教训）→ Task 1 文档步校验示例词在默认表内或确实可用
5. **极端 dt（NaN/巨大值）不抛错不挂死**——rAF 时间跳变是真实输入 → R41/R42 各含 `doesNotThrow` 断言

---

### Task 1: 词表与类型扩容（rain/lightning 进类型系统）

**Files:**
- Modify: `src/effects.ts:11`（EffectType 联合类型）、`src/effects.ts:31-38`（DEFAULT_EFFECT_TRIGGERS）
- Modify: `src/index.ts:187-188`（isValidEffectType）、`src/index.ts:200`（告警文案）
- Test: `test/effects.test.ts`（更新 R16；新增 R35–R39）
- Modify: `README.zh-CN.md:193-202`（默认词表表格+优先级说明）、`README.md` 对应段落（英文说明）

**Interfaces:**
- Consumes: 现有 `matchEffect` / `installFakeDom` / R30 缓存击穿手法
- Produces（后续任务与发布产物依赖）:
  - `type EffectType = 'fireworks' | 'confetti' | 'snow' | 'rain' | 'lightning'`
  - `DEFAULT_EFFECT_TRIGGERS` 16 键，插入序（即优先级）：`打雷→雷人→下雨→暴雨→翻车了→凉了→寄了→芭比Q了→下雪→雪花→初雪→烟花→撒花→庆祝→好耶→恭喜`，映射分别为 lightning/lightning/rain×6/snow×3/fireworks/confetti×4
  - `isValidEffectType` 放行五种；告警文案尾注改为「仅支持 fireworks / confetti / snow / rain / lightning」

- [ ] **Step 1: 写失败测试（R16 更新 + R35–R39 新增），集中进 `test/effects.test.ts`**

R16 只改期望表（其余断言不动）：

```ts
assert.deepEqual(DEFAULT_EFFECT_TRIGGERS, {
  '打雷': 'lightning', '雷人': 'lightning',
  '下雨': 'rain', '暴雨': 'rain', '翻车了': 'rain', '凉了': 'rain', '寄了': 'rain', '芭比Q了': 'rain',
  '下雪': 'snow', '雪花': 'snow', '初雪': 'snow',
  '烟花': 'fireworks',
  '撒花': 'confetti', '庆祝': 'confetti', '好耶': 'confetti', '恭喜': 'confetti',
});
```

```ts
test('R35: 键序即优先级，坏消息胜过好消息', () => {
  assert.deepEqual(Object.keys(DEFAULT_EFFECT_TRIGGERS),
    ['打雷', '雷人', '下雨', '暴雨', '翻车了', '凉了', '寄了', '芭比Q了', '下雪', '雪花', '初雪', '烟花', '撒花', '庆祝', '好耶', '恭喜']);
  assert.equal(matchEffect('庆祝上线打雷了', DEFAULT_EFFECT_TRIGGERS), 'lightning'); // 打雷胜过庆祝
  assert.equal(matchEffect('庆祝上线翻车了', DEFAULT_EFFECT_TRIGGERS), 'rain');      // 翻车了胜过庆祝（词表为准，非劈雷）
  assert.equal(matchEffect('恭喜下雪了', DEFAULT_EFFECT_TRIGGERS), 'snow');          // 下雪胜过恭喜
});

test('R36: 新词逐个映射正确，小写变体不误触发', () => {
  const t = DEFAULT_EFFECT_TRIGGERS;
  for (const w of ['打雷', '雷人']) assert.equal(matchEffect(w, t), 'lightning', w);
  for (const w of ['下雨', '暴雨', '翻车了', '凉了', '寄了', '芭比Q了']) assert.equal(matchEffect(w, t), 'rain', w);
  for (const w of ['下雪', '雪花', '初雪']) assert.equal(matchEffect(w, t), 'snow', w);
  assert.equal(matchEffect('恭喜', t), 'confetti');
  assert.equal(matchEffect('芭比q了', t), null); // 英文大小写敏感
});

test('R37: rain/lightning 通过非法值过滤，告警列全五种类型', async () => {
  const mod = await import(`../src/index.ts?r37=${Date.now()}`); // R30 缓存击穿：全新运行时
  const dom = installFakeDom();
  const warns: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: unknown[]): void => { warns.push(args.map(String).join(' ')); };
  try {
    mod.setEffects({ cooldownMs: 0, triggers: { '下雨': 'rain', '打雷': 'lightning', '坏词': 'boom' } as unknown as Record<string, EffectType> });
    assert.deepEqual(mod.getEffects().triggers, { '下雨': 'rain', '打雷': 'lightning' }); // 新类型放行，非法值丢弃
    assert.equal(warns.length, 1);
    assert.ok(warns[0].includes('rain') && warns[0].includes('lightning') && warns[0].includes('fireworks'),
      `告警应列出全部合法类型，实际：${warns[0]}`);
    mod.info('坏词');
    assert.equal(dom.created, 0);
    mod.info('下雨');
    assert.equal(dom.created, 1); // 过滤后照常全链路触发
  } finally {
    console.warn = origWarn;
    dom.teardown();
  }
});

test('R38: 生产环境对新词同样不触发', async () => {
  // R30 手法：先置 NODE_ENV=production 再缓存击穿 import，finally 恢复
  const dom = installFakeDom();
  /* 置 process.env.NODE_ENV='production' 后： */
  const mod = await import(`../src/index.ts?r38=${Date.now()}`);
  mod.info('下雨了');
  mod.info('打雷了');
  assert.equal(dom.created, 0);
});

test('R39: prefers-reduced-motion 对新词同样不触发', async () => {
  const dom = installFakeDom({ reducedMotion: true });
  const mod = await import(`../src/index.ts?r39=${Date.now()}`); // 全新运行时，冷却不干扰
  mod.setEffects({ cooldownMs: 0 });
  mod.info('打雷了');
  assert.equal(dom.created, 0);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --experimental-strip-types --test test/effects.test.ts`
Expected: FAIL——R16 期望表不符；R35/R36 命中新词返回 null；R37 新类型被当非法值丢弃；（R38/R39 可能已绿，属行为不变的守卫用例，可接受）

- [ ] **Step 3: 实现类型与词表（`src/effects.ts`）+ 放行与告警（`src/index.ts`）**

- `EffectType` 一行扩为 `'fireworks' | 'confetti' | 'snow' | 'rain' | 'lightning'`
- `DEFAULT_EFFECT_TRIGGERS` 按 R35 的键序整表替换（对象字面量键序即上表顺序）
- `isValidEffectType` 增 `|| value === 'rain' || value === 'lightning'`
- 告警文案尾注「仅支持 fireworks / confetti / snow」→「仅支持 fireworks / confetti / snow / rain / lightning」

- [ ] **Step 4: 跑测试确认通过**

Run: `node --experimental-strip-types --test test/effects.test.ts`
Expected: PASS（全文件，含 R16–R39）

- [ ] **Step 5: 更新 README 双语词表**

`README.zh-CN.md` 与 `README.md` 的默认词表表格换为 16 行（触发词即上表 16 词，动画列 `lightning`/`rain`/`snow`/`fireworks`/`confetti`），并在表格下补一行优先级说明：
- zh-CN：`键序即命中优先级：坏消息词排前——「庆祝上线翻车了」播的是下雨（翻车了 胜过 庆祝），「庆祝上线打雷了」播的是打雷。`
- en：`Key order is match priority: bad-news words come first, so '庆祝上线翻车了' plays rain (翻车了 beats 庆祝).`
- 校验示例词真实有效（扩展示例 `'开工': 'confetti'` 保留——confetti 仍合法）

- [ ] **Step 6: 全量回归 + 类型检查**

Run: `yarn test:unit:offline` 与 `npx tsc --noEmit`
Expected: 全绿；tsc 无输出

- [ ] **Step 7: 提交**

```bash
git add src/effects.ts src/index.ts test/effects.test.ts README.md README.zh-CN.md
git commit -m "feat(pkg): 触发词表扩为天气与吐槽两族，效果类型新增 rain/lightning

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 下雨效果（rain 引擎 + mockup 雨节）

**Files:**
- Create: `docs/superpowers/specs/2026-11-12-rain-lightning-mockup.html`（新建，含「下雨」一节；「打雷」一节留给 Task 3）
- Modify: `src/effects-render.ts`（模块头注释「三个动画」→「五个动画」；Snowflake 后新增 `Raindrop` 与 `makeRain`；`MAX_MS` 增 `rain: 6000`；`makers` 增 `rain: makeRain`）
- Test: `test/effects.test.ts`（新增 R40、R41）
- Modify: `test/test.html`（演示区增「下雨」按钮 + 监听）

**Interfaces:**
- Consumes: Task 1 的 `EffectType` 含 `'rain'`；既有 `EffectEngine` 接口（`step(ctx, dt): boolean`）
- Produces: 私有 `makeRain(w: number, h: number): EffectEngine`（注册于 `makers`）；`MAX_MS.rain = 6000`。`MAX_MS` 与 `makers` 都是 `Record<EffectType, …>`，类型扩容后 tsc 会强制两处补全，漏一处编译即错

- [ ] **Step 1: 写 mockup「下雨」一节（视觉基准先立）**

照 v1 mockup 的结构（单页 HTML、说明区 + 画布 + 播放按钮），新建 `docs/superpowers/specs/2026-11-12-rain-lightning-mockup.html`。雨节粒子参数（**与 Step 4 引擎同值，此表即基准**）：雨丝数 `n = min(220, round(w*h/2600)+40)`；单丝 `{x: rand*w*1.2-w*0.1, y: rand*h*1.1-h*0.1, vy: 3.2+rand*2.0, len: 8+rand*12, alpha: 0.25+rand*0.35}`；固定偏斜 `slant = 0.28`（`x += vy*slant*s`，线段画 `moveTo(p.x,p.y) → lineTo(p.x-len*slant, p.y-len)`）；描边 `rgba(110,130,165,alpha)`、`lineWidth 1`；**无摆动、无尾迹、无水花**；全部 `y > h+12` 移出即收。画布深灰底（对齐 v1 mockup 观感）。

- [ ] **Step 2: 写失败测试（R40、R41）**

```ts
test('R40: rain MAX_MS 封顶生效（6000ms 超时强收）', () => {
  const ctx = new Proxy({} as object, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  assert.equal(createEffectEngine('rain', 800, 600).step(ctx, 6001), true, 'rain 超 6s 必须强收');
  assert.equal(createEffectEngine('rain', 800, 600).step(ctx, 5999), false, 'rain 5999ms 不得提前强收（粒子仍在场）');
});

test('R41: rain 自然收尾 ≤5s、有实际绘制、极端 dt 不抛错', () => {
  let strokes = 0;
  const ctx = new Proxy({} as object, {
    get: (_t, k) => (k === 'stroke' ? () => { strokes++; } : () => undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const engine = createEffectEngine('rain', 800, 600);
  let done = false; let frames = 0;
  while (!done && frames < 2000) { done = engine.step(ctx, 16.7); frames++; }
  assert.ok(done, 'rain 必须收尾');
  assert.ok(frames <= 300, `rain 应在 5s 内自然收尾，实际 ${frames} 帧`);
  assert.ok(strokes > 0, 'rain 必须有绘制');
  assert.doesNotThrow(() => createEffectEngine('rain', 800, 600).step(ctx, NaN), '极端 dt 不得抛错');
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `node --experimental-strip-types --test test/effects.test.ts --test-name-pattern="R4[01]"`
Expected: FAIL——`makers['rain']` 不存在，`createEffectEngine('rain', …)` 抛 TypeError

- [ ] **Step 4: 实现 `makeRain` 并注册（`src/effects-render.ts`）**

签名 `makeRain(w: number, h: number): EffectEngine`。粒子与绘制参数照 Step 1 基准表逐值落实；`step` 结构沿 `makeSnow` 的遍历骨架（`s = Math.min(dt/16.7, 2.5)`，逐粒推进、越底 `continue`、`!alive` 即收），但**只画 stroke 斜线，不引入任何 `Math.sin` 摆动、拖尾数组或底部水花**。同步：`interface Raindrop { x: number; y: number; vy: number; len: number; alpha: number }`、`MAX_MS` 增 `rain: 6000`、`makers` 增 `rain: makeRain`、文件头注释改「五个动画（烟花/撒花/下雪/下雨/打雷）」。

- [ ] **Step 5: 跑测试确认通过**

Run: `node --experimental-strip-types --test test/effects.test.ts`
Expected: PASS（全文件）

- [ ] **Step 6: 演示按钮（`test/test.html`）**

按钮区 snow 按钮后加 `<button id="fx-btn-rain">info('下雨')</button>`；监听区对应加 `document.getElementById('fx-btn-rain').addEventListener('click', () => prettyLog.info('下雨'))`；把「三个按钮」注释改为「各按钮」。

- [ ] **Step 7: 浏览器对照 mockup 自检（截图或注明）**

浏览器工具可用时：打开 mockup 与 `test/test.html` 各截一张雨效图，对照形态（斜线方向一致、无摆动、无水花）；不可用则在报告注明未截图，由评审开 mockup 人工对照。

- [ ] **Step 8: 提交**

```bash
git add src/effects-render.ts test/effects.test.ts test/test.html docs/superpowers/specs/2026-11-12-rain-lightning-mockup.html
git commit -m "feat(pkg): 下雨粒子效果与 mockup 雨节基准

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 打雷效果（lightning 引擎 + 演示收尾 + 构建核对）

**Files:**
- Modify: `docs/superpowers/specs/2026-11-12-rain-lightning-mockup.html`（追加「打雷」一节，含浅底/深底双底板）
- Modify: `src/effects-render.ts`（新增 `makeLightning`；`MAX_MS` 增 `lightning: 3000`；`makers` 增 `lightning: makeLightning`）
- Test: `test/effects.test.ts`（新增 R42）
- Modify: `test/test.html`（演示区增「打雷」按钮 + 监听）

**Interfaces:**
- Consumes: Task 2 后的 `effects-render.ts`（makers/MAX_MS 结构）、Task 1 的 `EffectType` 含 `'lightning'`
- Produces: 私有 `makeLightning(w: number, h: number): EffectEngine`（注册于 `makers`）；`MAX_MS.lightning = 3000`

- [ ] **Step 1: mockup 追加「打雷」一节**

同文件加第二节：**浅色与深色两块底板各放一条折线**（可见性基准）。折线参数（**与 Step 4 引擎同值**）：一道锯齿折线，起点 `(w*(0.3+rand*0.4), -10)`，落点 `(w*(0.2+rand*0.6), h*(0.55+rand*0.3))`；中点位移 5 轮细分（33 段）；全屏闪白 `fillRect rgba(255,255,255,0.22)` 约 100ms；余晖渐隐约 900ms，总收尾 ≤2s；单次一击，不做多连闪。描边双层：深色底衬 `rgba(25,35,70,glow*0.55)` lineWidth 7 → 白芯 `rgba(255,255,255,glow)` lineWidth 2.5（浅底可见性的关键）。

- [ ] **Step 2: 写失败测试（R42）**

```ts
test('R42: lightning 2s 内收尾，有闪白与折线绘制，极端 dt 不抛错', () => {
  let fills = 0; let strokes = 0;
  const ctx = new Proxy({} as object, {
    get: (_t, k) => (k === 'fillRect' ? () => { fills++; } : k === 'stroke' ? () => { strokes++; } : () => undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const engine = createEffectEngine('lightning', 800, 600);
  let done = false; let frames = 0;
  while (!done && frames < 2000) { done = engine.step(ctx, 16.7); frames++; }
  assert.ok(done, 'lightning 必须收尾');
  assert.ok(frames <= 120, `lightning 应在 2s 内收尾，实际 ${frames} 帧`);
  assert.ok(fills > 0, '必须有全屏闪白');
  assert.ok(strokes > 0, '必须有折线绘制');
  assert.equal(createEffectEngine('lightning', 800, 600).step(ctx, 3001), true, 'lightning 超 3s 必须强收');
  assert.doesNotThrow(() => createEffectEngine('lightning', 800, 600).step(ctx, NaN), '极端 dt 不得抛错');
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `node --experimental-strip-types --test test/effects.test.ts --test-name-pattern="R42"`
Expected: FAIL——`makers['lightning']` 不存在，抛 TypeError

- [ ] **Step 4: 实现 `makeLightning` 并注册（`src/effects-render.ts`）**

签名 `makeLightning(w: number, h: number): EffectEngine`。中点位移算法（计划给定，照抄）：

```ts
// pts 初始两点：起点 (w*(0.3+Math.random()*0.4), -10)，落点 (w*(0.2+Math.random()*0.6), h*(0.55+Math.random()*0.3))
// 5 轮细分：对相邻点取中点，x 加 (Math.random()-0.5) * 段长 * 0.5 的水平位移，y 不动；每轮后段数翻倍，终态 33 段
```

计时：`t += dt`；`t > 100 + 900` 返回 true；`glow = t < 100 ? 1 : max(0, 1 - (t-100)/900)`。每帧：`t < 100` 时先 `fillRect(0,0,w,h)` 闪白；随后按 mockup 双层描边画折线（`beginPath` → 逐点 `moveTo`/`lineTo` → 两次 `stroke`）。同步 `MAX_MS` 增 `lightning: 3000`、`makers` 增 `lightning: makeLightning`。

- [ ] **Step 5: 跑测试确认通过**

Run: `node --experimental-strip-types --test test/effects.test.ts`
Expected: PASS（全文件）

- [ ] **Step 6: 演示按钮（`test/test.html`）**

按钮区 rain 按钮后加 `<button id="fx-btn-lightning">info('打雷')</button>` + 对应监听 `prettyLog.info('打雷')`。

- [ ] **Step 7: 浏览器对照 mockup 自检（重点浅底）**

浏览器工具可用时：浅色与深色页面各截一张闪电图，对照 mockup 双底板（浅底上白芯+深衬必须立得住）；不可用则报告注明，由评审人工对照。

- [ ] **Step 8: 集成核对**

Run: `yarn test:unit:offline` → 全绿；`npx tsc --noEmit` → 无输出；`yarn build` 后 `grep -c "lightning" dist/types.d.ts` → ≥1（`EffectType` 新成员进了发布类型面）

- [ ] **Step 9: 提交**

```bash
git add src/effects-render.ts test/effects.test.ts test/test.html docs/superpowers/specs/2026-11-12-rain-lightning-mockup.html
git commit -m "feat(pkg): 打雷闪电效果、演示按钮与构建产物核对

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
