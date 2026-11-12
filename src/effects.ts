/**
 * 触发词动画效果配置与防轰炸运行时
 *
 * 本模块提供类型、默认值、触发词匹配与防轰炸运行时，供 src/index.ts 的配置接线与后续动画模块使用。
 * 顶层不得触碰 window/document，保证 Node 环境导入安全。
 */

/**
 * 动画效果类型
 */
export type EffectType = 'fireworks' | 'confetti' | 'snow' | 'rain' | 'lightning';

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
  '打雷': 'lightning', '雷人': 'lightning',
  '下雨': 'rain', '暴雨': 'rain', '翻车了': 'rain', '凉了': 'rain', '寄了': 'rain', '芭比Q了': 'rain',
  '下雪': 'snow', '雪花': 'snow', '初雪': 'snow',
  '烟花': 'fireworks',
  '撒花': 'confetti', '庆祝': 'confetti', '好耶': 'confetti', '恭喜': 'confetti',
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

/**
 * 播放函数签名：接收效果类型与结束回调。
 * 契约：必须恰好调用一次 onEnd（无法播放时立即调用）。
 */
export type EffectPlay = (type: EffectType, onEnd: () => void) => void;

/**
 * 防轰炸运行时：全局单飞 + 播后冷却
 */
export interface EffectsRuntime {
  /**
   * 触发处理：命中且可播时返回效果类型，否则 null。
   * 流程：enabled=false → null；matchEffect 未命中 → null；
   * 正在播放（单飞）或冷却中 → null；否则标记播放中、调 play、返回类型。
   */
  handle(text: string, opts: Required<EffectsOptions>, play: EffectPlay): EffectType | null;
}

/**
 * 创建防轰炸运行时。每个实例有独立的单飞与冷却状态（闭包隔离）。
 * @param clock 时间源，默认 Date.now，测试可注入假时钟
 */
export function createEffectsRuntime(clock: () => number = Date.now): EffectsRuntime {
  let playing = false;        // 单飞：播放中拒绝再次触发
  let cooldownUntil = 0;      // 冷却截止时刻（自播放结束起算）

  return {
    handle(text, opts, play): EffectType | null {
      if (opts.enabled === false) return null;
      const type = matchEffect(text, opts.triggers);
      if (type === null) return null;
      if (playing || clock() < cooldownUntil) return null;

      playing = true;
      let ended = false;
      const onEnd = (): void => {
        if (ended) return; // 防重入：play 违约重复调用时忽略
        ended = true;
        cooldownUntil = clock() + opts.cooldownMs; // 冷却自播放结束起算
        playing = false;
      };
      try {
        play(type, onEnd);
      } catch {
        onEnd(); // play 抛错时代为释放状态；动画是彩蛋，绝不影响日志链路
      }
      return type;
    },
  };
}
