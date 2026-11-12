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
