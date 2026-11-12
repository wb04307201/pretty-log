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
