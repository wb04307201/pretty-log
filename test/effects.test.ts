import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EFFECT_TRIGGERS, DEFAULT_EFFECT_COOLDOWN_MS, matchEffect, createEffectsRuntime, type EffectType, type EffectPlay, type EffectsOptions } from '../src/effects.ts';
import { configure, setEffects, getEffects } from '../src/index.ts';

const opts = (over: Partial<EffectsOptions> = {}): Required<EffectsOptions> => ({
  enabled: true,
  triggers: { ...DEFAULT_EFFECT_TRIGGERS },
  cooldownMs: 2000,
  ...over,
});

test('R16: 默认触发词表精确、均≥2字符、默认状态正确', () => {
  assert.deepEqual(DEFAULT_EFFECT_TRIGGERS, {
    '打雷': 'lightning', '雷人': 'lightning',
    '下雨': 'rain', '暴雨': 'rain', '翻车了': 'rain', '凉了': 'rain', '寄了': 'rain', '芭比Q了': 'rain',
    '下雪': 'snow', '雪花': 'snow', '初雪': 'snow',
    '烟花': 'fireworks',
    '撒花': 'confetti', '庆祝': 'confetti', '好耶': 'confetti', '恭喜': 'confetti',
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

// ---------------------------------------------------------------- R28–R33 输出挂钩与浏览器行为

import * as pl from '../src/index.ts';

const { info, error, rainbow, group, table, picture, time, timeEnd, timer, once, setLogLevel } = pl;

/** 还原效果配置为库默认（各用例 finally 用） */
const resetEffects = (): void => {
  setEffects({ enabled: true, triggers: { ...DEFAULT_EFFECT_TRIGGERS }, cooldownMs: 2000 });
};

/**
 * 安装假 DOM：window / document / Image / requestAnimationFrame / performance 全部
 * 替换为虚拟时间实现，用完必须 teardown 还原。
 *
 * - 假 canvas：style.cssText 赋值被记录原文；getContext 返回万能 Proxy ctx；remove 计数
 * - body.appendChild 计数（= created，实际挂载的 overlay 数）
 * - requestAnimationFrame 同步递归调用回调、虚拟时间戳每次 +16.7；
 *   单条动画链上限 3000 次防死循环（引擎有 MAX_MS 封顶必然收尾），
 *   链条收尾（递归归零）后计数重置，互不影响
 * - performance.now 返回同一虚拟时钟（播放器以它计算 dt，虚拟时间不走引擎永远收不了尾）
 */
function installFakeDom({ reducedMotion = false } = {}): {
  created: number;
  removed: number;
  cssText: string;
  teardown: () => void;
} {
  const state = { created: 0, removed: 0, cssText: '' };
  const keys = ['window', 'document', 'Image', 'requestAnimationFrame', 'performance'] as const;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const key of keys) saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));

  // 虚拟时钟：rAF 每次调用推进 16.7ms，performance.now 读同一时钟
  let virtualNow = 0;
  let chainCalls = 0;
  let chainDepth = 0;
  const raf = (cb: (t: number) => void): number => {
    chainCalls += 1;
    if (chainCalls > 3000) return 0; // 防死循环：超限不再续帧
    virtualNow += 16.7;
    chainDepth += 1;
    try {
      cb(virtualNow);
    } finally {
      chainDepth -= 1;
      if (chainDepth === 0) chainCalls = 0; // 单条动画链播完后重置计数
    }
    return 0;
  };

  const ctxProxy = new Proxy({} as object, {
    get: () => () => undefined,
    set: () => true,
  });

  const fakeDocument = {
    createElement: (_tag: string) => {
      const style: Record<string, unknown> = {};
      Object.defineProperty(style, 'cssText', {
        get: () => state.cssText,
        set: (v: string) => { state.cssText = v; },
        enumerable: true,
        configurable: true,
      });
      return {
        style,
        width: 0,
        height: 0,
        getContext: () => ctxProxy,
        remove: () => { state.removed += 1; },
      };
    },
    body: {
      appendChild: () => { state.created += 1; },
    },
  };

  class FakeImage {
    crossOrigin = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) { /* 加载永不发生，onload / onerror 均不触发 */ }
  }

  const fakeWindow = {
    devicePixelRatio: 2,
    innerWidth: 800,
    innerHeight: 600,
    matchMedia: (_q: string) => ({ matches: reducedMotion }),
    requestAnimationFrame: raf,
  };

  const g = globalThis as Record<string, unknown>;
  g.window = fakeWindow;
  g.document = fakeDocument;
  g.Image = FakeImage;
  g.requestAnimationFrame = raf;
  Object.defineProperty(g, 'performance', {
    value: { now: () => virtualNow },
    writable: true,
    configurable: true,
    enumerable: true,
  });

  return {
    get created() { return state.created; },
    get removed() { return state.removed; },
    get cssText() { return state.cssText; },
    teardown() {
      for (const key of keys) {
        const desc = saved.get(key);
        if (desc) Object.defineProperty(globalThis, key, desc);
        else delete g[key];
      }
    },
  };
}

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

// ---------------------------------------------------------------- R34 非法触发值过滤

test('R34: 非法触发值在配置时被过滤并告警，合法项照常触发', async () => {
  // 独立模块实例（R30 的缓存击穿手法）：自带全新防轰炸运行时，
  // 不受 R28–R33 在单例运行时上留下的冷却/单飞状态影响
  const mod = await import(`../src/index.ts?r34=${Date.now()}`);
  const dom = installFakeDom();
  const warns: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: unknown[]): void => { warns.push(args.map(String).join(' ')); };
  try {
    const badTriggers = { '烟花': 'fireworks', '坏词': 'boom' } as unknown as Record<string, EffectType>;
    mod.setEffects({ cooldownMs: 0, triggers: badTriggers });

    assert.deepEqual(mod.getEffects().triggers, { '烟花': 'fireworks' }); // 非法值被丢弃，整表替换语义不变
    assert.equal(warns.length, 1);                                      // 每个被丢弃的键告警一次
    assert.ok(
      warns[0].includes('坏词') && warns[0].includes('boom'),
      `告警应包含触发词键与非法值，实际：${warns[0]}`
    );

    mod.info('坏词');                          // 非法值已丢弃：不触发
    assert.equal(dom.created, 0);
    mod.info('烟花');                          // 合法项照常触发
    assert.equal(dom.created, 1);
  } finally {
    console.warn = origWarn;
    dom.teardown();
  }
});

// ---------------------------------------------------------------- R35–R39 词表扩容（rain/lightning 进类型系统）

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
  const prev = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const mod = await import(`../src/index.ts?r38=${Date.now()}`);
    mod.info('下雨了');
    mod.info('打雷了');
    assert.equal(dom.created, 0);
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prev;
    dom.teardown();
  }
});

test('R39: prefers-reduced-motion 对新词同样不触发', async () => {
  const dom = installFakeDom({ reducedMotion: true });
  try {
    const mod = await import(`../src/index.ts?r39=${Date.now()}`); // 全新运行时，冷却不干扰
    mod.setEffects({ cooldownMs: 0 });
    mod.info('打雷了');
    assert.equal(dom.created, 0);
  } finally {
    dom.teardown();
  }
});

// ---------------------------------------------------------------- R40–R41 rain 引擎

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
