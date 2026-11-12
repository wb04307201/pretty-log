/**
 * 触发词动画效果配置（纯类型与默认常量）
 *
 * 本模块只提供类型与默认值，供 src/index.ts 的配置接线与后续动画模块使用。
 * 顶层不得触碰 window/document，保证 Node 环境导入安全。
 */

/**
 * 动画效果类型
 */
export type EffectType = 'fireworks' | 'confetti' | 'snow';

/**
 * 效果配置项，各字段均可缺省，由 setEffects/configure 做部分合并
 */
export interface EffectsOptions {
  /** 是否启用触发词动画，默认 true */
  enabled?: boolean;
  /**
   * 触发词表：词 → 效果类型。
   * 键的插入顺序即多词命中时的优先级；传入即整表替换（允许 {}）。
   */
  triggers?: Record<string, EffectType>;
  /** 同一效果两次触发的最小间隔毫秒，默认 2000 */
  cooldownMs?: number;
}

/**
 * 默认触发词表（键序即命中优先级，均为 ≥2 字符的词组）
 */
export const DEFAULT_EFFECT_TRIGGERS: Record<string, EffectType> = {
  '烟花': 'fireworks',
  '撒花': 'confetti',
  '庆祝': 'confetti',
  '好耶': 'confetti',
  '下雪': 'snow',
  '雪花': 'snow',
};

/**
 * 默认触发冷却时间（毫秒）
 */
export const DEFAULT_EFFECT_COOLDOWN_MS = 2000;

/**
 * 触发词匹配：按 triggers 插入序遍历，第一个 text.includes(key) 命中的键返回其动画类型。
 * 空串键跳过（includes('') 恒真，必须显式排除）；大小写敏感；无命中返回 null。
 */
export function matchEffect(text: string, triggers: Record<string, EffectType>): EffectType | null {
  for (const [key, effect] of Object.entries(triggers)) {
    if (key.length === 0) continue; // 空键恒真，跳过
    if (text.includes(key)) return effect;
  }
  return null;
}
