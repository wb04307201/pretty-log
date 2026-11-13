import {
  DEFAULT_EFFECT_TRIGGERS,
  DEFAULT_EFFECT_COOLDOWN_MS,
  createEffectsRuntime,
  type EffectType,
  type EffectsOptions,
} from './effects.ts';
import { playEffectInBrowser } from './effects-render.ts';

export type { EffectType, EffectsOptions };
export { DEFAULT_EFFECT_TRIGGERS };

type LogContent = string | number | boolean | object | null | undefined;

/**
 * 日志级别定义
 * debug(0) < info(1) < warn(2) < error(3) < none(4)
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LOG_LEVEL_VALUE: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

/**
 * 主题模式：深色 / 浅色控制台底
 *
 * fills/rainbow/badgeText 两底通用；texts 按 mode 取对应预设。
 */
export type ThemeMode = 'dark' | 'light';

/**
 * 徽章填充色（含 accent），两底通用
 */
export interface ThemeFills {
  debug: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  group: string;
  accent: string;
}

/**
 * 文字色，按 mode 取深/浅预设
 */
export interface ThemeTexts {
  debug: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  group: string;
  time: string;
  null: string;
  meta: string;
  body: string;
}

/**
 * rainbow 渐变与文字
 */
export interface RainbowTheme {
  colors: string[];
  text: string;
}

/**
 * 主题（P1 预设 + 用户覆盖的合并结果）
 */
export interface Theme {
  mode: ThemeMode;
  badgeText: string;
  fills: ThemeFills;
  texts: ThemeTexts;
  rainbow: RainbowTheme;
}

/**
 * 主题部分覆盖
 *
 * 未提及项不动；值传 undefined 的项恢复预设默认（删除覆盖）。
 */
export interface ThemeUpdate {
  mode?: ThemeMode;
  /** undefined = 恢复默认 */
  badgeText?: string | undefined;
  fills?: { [K in keyof ThemeFills]?: string | undefined };
  texts?: { [K in keyof ThemeTexts]?: string | undefined };
  rainbow?: { colors?: string[]; text?: string | undefined };
}

/**
 * 日志级别对应的主题角色名（内部）
 */
type LevelRole = 'debug' | 'info' | 'success' | 'warning' | 'error';

// ================== P1 预设（柔雾低饱） ==================

/** P1 预设：徽章填充色（两底通用） */
const P1_FILLS: ThemeFills = {
  debug: '#a5b4fc',
  info: '#93c5fd',
  success: '#86efac',
  warning: '#fde68a',
  error: '#fca5a5',
  group: '#c4b5fd',
  accent: '#93c5fd',
};

/** P1 预设：徽章文字（压色块，两底通用） */
const P1_BADGE_TEXT = '#1f2330';

/** P1 预设：rainbow 渐变与文字 */
const P1_RAINBOW: RainbowTheme = {
  colors: ['#f9a8d4', '#c4b5fd', '#93c5fd', '#6ee7b7', '#fde68a'],
  text: '#23273a',
};

/** P1 预设：深底文字色 */
const P1_TEXTS_DARK: ThemeTexts = {
  debug: '#a5b4fc',
  info: '#93c5fd',
  success: '#86efac',
  warning: '#fde68a',
  error: '#fca5a5',
  group: '#c4b5fd',
  time: '#93c5fd',
  null: '#8b93a7',
  meta: '#8b93a7',
  body: '#e8eaed',
};

/** P1 预设：浅底文字色 */
const P1_TEXTS_LIGHT: ThemeTexts = {
  debug: '#6366f1',
  info: '#2563eb',
  success: '#15803d',
  warning: '#b45309',
  error: '#dc2626',
  group: '#6d28d9',
  time: '#2563eb',
  null: '#6b7280',
  meta: '#5f6368',
  body: '#3c4043',
};

/**
 * 解析初始主题模式：浏览器跟随系统 prefers-color-scheme；
 * 无 matchMedia 的环境（如 Node 测试）或探测失败一律回退浅色。
 *
 * 模块加载时解析一次，作为 ConfigManager 初始 mode 与 resetTheme() 的归位目标。
 */
function resolveDefaultMode(): ThemeMode {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch {
    /* 探测失败回退浅色 */
  }
  return 'light';
}

/** 环境默认主题模式（模块加载时解析一次） */
const ENV_DEFAULT_MODE: ThemeMode = resolveDefaultMode();

/**
 * 日志框样式配置
 *
 * 此前样式字符串硬编码在 prettyPrint 中，用户无法调整圆角与内边距。
 * 每项均可传 undefined 恢复默认值。
 */
export interface Styles {
  /** 圆角，默认 '2px' */
  borderRadius?: string;
  /** 内边距，默认 '1px' */
  padding?: string;
  /** 徽章文字颜色（与 setTheme({ badgeText }) 读写同一存储槽），默认 '#1f2330' */
  titleColor?: string;
  /** 边框宽度，默认 '1px' */
  borderWidth?: string;
  /** 边框样式，默认 'solid' */
  borderStyle?: string;
}

/**
 * 默认样式
 */
const DEFAULT_STYLES: Required<Styles> = {
  borderRadius: '2px',
  padding: '1px',
  titleColor: P1_BADGE_TEXT,
  borderWidth: '1px',
  borderStyle: 'solid',
};

/**
 * 日志条目，用于历史记录
 */
export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  title: string;
  content: LogContent[];
}

/**
 * 表格渲染模式：'pretty' 自绘美化表格（默认）/ 'native' 原生 console.table 降级
 */
export type TableMode = 'pretty' | 'native';

/**
 * 默认历史容量
 */
const DEFAULT_HISTORY_SIZE = 200;

/**
 * 归一化历史容量输入，非法值回退到默认容量
 *
 * `new Array(n)` 对负数、小数、NaN、Infinity 都会抛 RangeError，
 * 而公开 API 接受任意 number（含来自环境变量的字符串转换结果），
 * 因此必须在入口处夹紧并取整，而不是让异常逃逸到调用方。
 *
 * @param size 调用方传入的容量
 * @returns 合法容量：0（禁用）或正整数
 */
const normalizeHistorySize = (size: number): number => {
  // 非有限值（NaN / Infinity / -Infinity）无法取整，直接回退默认
  if (!Number.isFinite(size)) return DEFAULT_HISTORY_SIZE;
  const floored = Math.floor(size);
  // 负数与小数归零：0 是文档承诺的"禁用"语义，不应抛错
  return floored > 0 ? floored : 0;
};

/**
 * 固定大小循环缓冲区，用于日志历史
 */
class HistoryBuffer {
  private buffer: (LogEntry | null)[];
  private size: number;
  private head: number;
  private count: number;

  constructor(capacity: number) {
    this.size = capacity;
    this.buffer = new Array(capacity).fill(null);
    this.head = 0;
    this.count = 0;
  }

  push(entry: LogEntry): void {
    if (this.size === 0) return;
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.size;
    if (this.count < this.size) this.count++;
  }

  get(): LogEntry[] {
    const result: LogEntry[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.size) % this.size;
      const entry = this.buffer[idx];
      if (entry) result.push(entry);
    }
    return result;
  }

  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.count = 0;
  }

  /**
   * 调整容量并保留现有条目（按时间顺序保留最近的）
   */
  resize(capacity: number): void {
    if (capacity === this.size) return;

    // 先按顺序取出旧条目，避免重建时丢失数据
    const existing = this.get();
    this.size = capacity;
    this.buffer = new Array(capacity).fill(null);
    this.head = 0;
    this.count = 0;

    // 容量为 0 表示禁用历史
    if (capacity === 0) return;

    // 容量变小时只保留最近的 capacity 条
    for (const entry of existing.slice(-capacity)) {
      this.push(entry);
    }
  }

  get length(): number {
    return this.count;
  }
}

/**
 * 合法动画效果类型判定（防御未类型化调用方传入非法触发值）
 */
const isValidEffectType = (value: unknown): value is EffectType =>
  value === 'fireworks' || value === 'confetti' || value === 'snow' || value === 'rain' || value === 'lightning';

/**
 * 过滤非法触发值：每个被丢弃的键 console.warn 一次（告警含键与非法值）。
 * 整表替换语义不变——过滤后的表一次性替换旧表（过滤后允许 {}）
 */
const sanitizeTriggers = (triggers: Record<string, unknown>): Record<string, EffectType> => {
  const filtered: Record<string, EffectType> = {};
  for (const [word, type] of Object.entries(triggers)) {
    if (isValidEffectType(type)) {
      filtered[word] = type;
    } else {
      console.warn(`[pretty-log] 触发词「${word}」的动画类型「${String(type)}」非法，已忽略（仅支持 fireworks / confetti / snow / rain / lightning）`);
    }
  }
  return filtered;
};

/**
 * 配置管理器
 */
class ConfigManager {
  private _logLevel: LogLevel = 'debug';
  private _mode: ThemeMode = ENV_DEFAULT_MODE;
  private _fillOverrides: Partial<Record<keyof ThemeFills, string>> = {};
  private _textOverrides: Partial<Record<keyof ThemeTexts, string>> = {};
  private _rainbowColors?: string[];
  private _rainbowText?: string;
  private _styles: Required<Styles> = { ...DEFAULT_STYLES };
  private _showEmoji: boolean = false;
  private _showTimestamp: boolean = false;
  private _historySize: number = DEFAULT_HISTORY_SIZE;
  private _tableMode: TableMode = 'pretty';
  private _effectsEnabled: boolean = true;
  private _effectTriggers: Record<string, EffectType> = { ...DEFAULT_EFFECT_TRIGGERS };
  private _effectCooldownMs: number = DEFAULT_EFFECT_COOLDOWN_MS;
  private _history: HistoryBuffer;

  constructor() {
    this._history = new HistoryBuffer(this._historySize);
  }

  /**
   * 构建日志框的 CSS 样式
   *
   * 标题段：fill 作背景与边框，文字用 badgeText（即 styles.titleColor）；
   * 内容段：边框与文字都用 textColor；几何参数（padding/borderWidth 等）沿用 Styles。
   * 颜色声明写作「color: 值 ;」——值两侧留空格，使色值在样式串中以空格定界。
   *
   * @param fill 徽章填充色（标题段背景与边框）
   * @param textColor 内容段边框与文字色
   * @param isTitle true 为标题样式（带背景），false 为内容样式（仅边框）
   */
  buildBoxStyle(fill: string, textColor: string, isTitle: boolean): string {
    const s = this._styles;
    return isTitle
      ? `background:${fill};border:${s.borderWidth} ${s.borderStyle} ${fill}; padding: ${s.padding}; border-radius: ${s.borderRadius}; color: ${s.titleColor} ;`
      : `border:${s.borderWidth} ${s.borderStyle} ${textColor}; padding: ${s.padding}; border-radius: ${s.borderRadius}; color: ${textColor} ;`;
  }

  get styles(): Required<Styles> {
    return { ...this._styles };
  }

  get logLevel(): LogLevel {
    return this._logLevel;
  }

  set logLevel(level: LogLevel) {
    this._logLevel = level;
  }

  /**
   * 当前主题 = P1 预设（texts 按 mode 取）+ 用户覆盖
   *
   * badgeText 与 styles.titleColor 同槽，直接读样式槽。
   */
  get theme(): Theme {
    const presetTexts = this._mode === 'dark' ? P1_TEXTS_DARK : P1_TEXTS_LIGHT;
    return {
      mode: this._mode,
      badgeText: this._styles.titleColor,
      fills: { ...P1_FILLS, ...this._fillOverrides },
      texts: { ...presetTexts, ...this._textOverrides },
      rainbow: {
        colors: this._rainbowColors ? [...this._rainbowColors] : [...P1_RAINBOW.colors],
        text: this._rainbowText ?? P1_RAINBOW.text,
      },
    };
  }

  /**
   * 合并部分样式覆盖，值为 undefined 的项恢复默认
   */
  applyStyles(partial: Partial<Styles>): void {
    for (const key of Object.keys(partial) as (keyof Styles)[]) {
      const value = partial[key];
      this._styles[key] = value === undefined ? DEFAULT_STYLES[key] : value;
    }
  }

  get showEmoji(): boolean {
    return this._showEmoji;
  }

  set showEmoji(value: boolean) {
    this._showEmoji = value;
  }

  get showTimestamp(): boolean {
    return this._showTimestamp;
  }

  set showTimestamp(value: boolean) {
    this._showTimestamp = value;
  }

  get historySize(): number {
    return this._historySize;
  }

  set historySize(size: number) {
    const normalized = normalizeHistorySize(size);
    this._historySize = normalized;
    this._history.resize(normalized);
  }

  /**
   * 表格渲染模式（调用时现读，setTableMode 立即生效）
   */
  get tableMode(): TableMode {
    return this._tableMode;
  }

  set tableMode(mode: TableMode) {
    this._tableMode = mode;
  }

  /**
   * 合并部分主题覆盖
   *
   * 未提及项不动；值为 undefined 的项删除覆盖（恢复当前 mode 的预设）。
   * 用户覆盖跨 mode 保留——mode 只切换未被覆盖的预设值。
   * badgeText 与 styles.titleColor 同槽，传 undefined 恢复默认。
   */
  applyTheme(partial: ThemeUpdate): void {
    if (partial.mode !== undefined) this._mode = partial.mode;
    if ('badgeText' in partial) {
      this._styles.titleColor = partial.badgeText ?? DEFAULT_STYLES.titleColor;
    }
    if (partial.fills) {
      for (const key of Object.keys(partial.fills) as (keyof ThemeFills)[]) {
        const value = partial.fills[key];
        if (value === undefined) delete this._fillOverrides[key];
        else this._fillOverrides[key] = value;
      }
    }
    if (partial.texts) {
      for (const key of Object.keys(partial.texts) as (keyof ThemeTexts)[]) {
        const value = partial.texts[key];
        if (value === undefined) delete this._textOverrides[key];
        else this._textOverrides[key] = value;
      }
    }
    if (partial.rainbow) {
      if ('colors' in partial.rainbow) {
        // 空数组视同 undefined：恢复默认五色（覆盖层不存空数组，杜绝非法 CSS）
        const colors = partial.rainbow.colors;
        this._rainbowColors = colors && colors.length > 0 ? [...colors] : undefined;
      }
      if ('text' in partial.rainbow) {
        this._rainbowText = partial.rainbow.text;
      }
    }
  }

  /**
   * 清空主题覆盖并回到环境默认（模块加载时解析值；badgeText 同槽一并恢复默认）
   */
  resetTheme(): void {
    this._mode = ENV_DEFAULT_MODE;
    this._fillOverrides = {};
    this._textOverrides = {};
    this._rainbowColors = undefined;
    this._rainbowText = undefined;
    this._styles.titleColor = DEFAULT_STYLES.titleColor;
  }

  /**
   * 合并部分效果配置：只处理显式提供（!== undefined）的项；
   * triggers 传入即整表替换（允许 {}），未提及项不动。
   * 非法动画类型的条目在配置时被过滤，并对每个被丢弃的键 console.warn 一次
   */
  applyEffects(partial: EffectsOptions): void {
    if (partial.enabled !== undefined) this._effectsEnabled = partial.enabled;
    if (partial.cooldownMs !== undefined) this._effectCooldownMs = partial.cooldownMs;
    if (partial.triggers !== undefined) this._effectTriggers = sanitizeTriggers(partial.triggers);
  }

  /**
   * 效果开关（零分配读取，输出热路径守卫用）
   */
  get effectsEnabled(): boolean {
    return this._effectsEnabled;
  }

  /**
   * 当前效果配置（不拷贝 triggers，供内部挂钩读取）
   */
  effectOptions(): Required<EffectsOptions> {
    return {
      enabled: this._effectsEnabled,
      triggers: this._effectTriggers,
      cooldownMs: this._effectCooldownMs,
    };
  }

  /**
   * 检查日志级别是否应该输出
   */
  shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUE[level] >= LOG_LEVEL_VALUE[this._logLevel];
  }

  /**
   * 写入历史
   */
  pushHistory(entry: LogEntry): void {
    this._history.push(entry);
  }

  getHistory(): LogEntry[] {
    return this._history.get();
  }

  clearHistory(): void {
    this._history.clear();
  }
}

/**
 * 生产环境判定
 *
 * 浏览器与 Node 下读取方式不同：打包器通常把 process.env.NODE_ENV
 * 静态替换为字面量（便于 tree-shaking），但本库不依赖 @types/node，
 * 故用局部声明而非直接引用全局 process 类型。
 */
declare const process: { env?: Record<string, string | undefined> } | undefined;

const IS_PRODUCTION: boolean =
  typeof process !== 'undefined' &&
  process.env !== undefined &&
  process.env.NODE_ENV === 'production';

// 全局配置实例
const config = new ConfigManager();

/**
 * 构造 JSON.stringify 的 replacer，正确区分「循环引用」与「共享引用」
 *
 * 原实现用 WeakSet 记录「访问过的所有对象」，于是同一对象被引用两次
 * （DAG，非循环）也会被误标成 `[Circular]` —— 日志失真。
 *
 * 正确做法是维护「当前祖先链」栈：只有当 value 仍在自己的祖先栈上时才算循环。
 * replacer 以 `this` 持有当前持有者，回溯时把栈顶直到等于 `this` 的部分弹出，
 * 剩下的栈恰好就是从根到当前的路径；重复出现的兄弟节点不在栈上，会被正常打印。
 */
const jsonReplacer = (): ((this: unknown, key: string, value: unknown) => unknown) => {
  // 祖先链：序列化过程中按进入顺序维护的路径栈
  const ancestors: unknown[] = [];

  return function (this: unknown, key: string, value: unknown): unknown {
    // Date 必须在此拦截，且必须在下面的基本类型早退之前：
    // JSON.stringify 会先调用 value.toJSON() 再把结果交给 replacer，
    // 此刻 value 已是 ISO 字符串（非 object），若先做 typeof 判断会直接返回，永远走不到下面。
    // replacer 的 this 是持有者，this[key] 仍指向原始 Date，据此取回再格式化。
    if (this !== null && typeof this === 'object') {
      const original = (this as Record<string, unknown>)[key];
      if (original instanceof Date) {
        return Number.isNaN(original.getTime()) ? 'Invalid Date' : original.toLocaleString();
      }
    }

    // 基本类型与 null 直接返回，无需入栈
    if (typeof value !== 'object' || value === null) return value;

    // Map / Set 没有序列化协议，放任其进入必然输出 {}，故在此拦截。
    // 顶层与嵌套共用本 replacer，故一次修好两处。
    if (value instanceof Map) return formatMap(value);
    if (value instanceof Set) return formatSet(value);

    // 弹出比当前持有者更深的栈帧，剩下的即当前祖先链
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }

    // 命中祖先链 → 真正的循环引用
    if (ancestors.includes(value)) return '[Circular]';

    ancestors.push(value);
    return value;
  };
};

/**
 * 展开 Map 为可读的对象表示
 *
 * `JSON.stringify` 对 Map / Set 一律输出 `{}`，必须手工展开。
 * 键经 stringify 处理（对象键会变成其字符串表示），值原样保留，
 * 以便嵌套对象仍按 JSON 结构展开而非被提前拍平成字符串。
 */
const formatMap = (map: Map<unknown, unknown>): Record<string, LogContent> => {
  const result: Record<string, LogContent> = {};
  let index = 0;
  for (const [key, value] of map) {
    const name = typeof key === 'object' && key !== null ? stringify(key) : String(key);
    result[name || `entry${index}`] = value as LogContent;
    index++;
  }
  return result;
};

/**
 * 展开 Set 为数组表示
 */
const formatSet = (set: Set<unknown>): unknown[] => {
  const result: unknown[] = [];
  for (const value of set) result.push(value);
  return result;
};

/**
 * 将值转换为字符串表示形式
 *
 * @param value - 需要转换的值，可以是任意类型
 * @returns {string} 字符串形式的值
 *
 * 转换规则：
 * - Error → 打印 message 与 stack（否则 JSON 序列化得到空对象，堆栈完全丢失）
 * - Map / Set → 手工展开为对象 / 数组（否则同样是空对象）
 * - Date → 本地可读时间（toJSON 会退化成难以阅读的 ISO 串）
 * - 其他对象 → JSON 字符串，用「祖先链」检测真正的循环引用
 * - 否则 → String()
 */
const stringify = (value: LogContent): string => {
  try {
    if (value instanceof Error) {
      return value.stack ? String(value.stack) : `${value.name}: ${value.message}`;
    }
    if (value instanceof Map) {
      return JSON.stringify(formatMap(value), jsonReplacer());
    }
    if (value instanceof Set) {
      return JSON.stringify(formatSet(value), jsonReplacer());
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toLocaleString();
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, jsonReplacer()) ?? String(value);
    }
    return String(value);
  } catch {
    return String(value);
  }
};

/**
 * 转义 console 格式串中的百分号
 *
 * 日志内容会被拼进 `%c` 模板串，用户内容里的 `%c` / `%s` 会被浏览器
 * 当作格式符解析：多消耗 CSS 实参导致样式整体错位，末尾的 `%s` 也会
 * 被前面的 `%c` 吃掉。把 `%` 转义为 `%%` 即可，内容原样显示。
 *
 * @param text 已 stringify 的日志内容
 * @returns 转义后的内容
 */
const escapeFormat = (text: string): string => text.replace(/%/g, '%%');

/**
 * Emoji 前缀映射
 *
 * 键为 LogLevel（'debug' | 'info' | 'warn' | 'error' | 'none'）。
 * 早期版本误用 'warning' 作为键，而 warning 日志实际传的是 'warn'，
 * 导致警告永远取不到 emoji；group/time/rainbow 复用 'info' 也取不到
 * 各自的专属 emoji，故这里额外提供按场景查表的辅助函数。
 */
const EMOJI_MAP: Record<string, string> = {
  debug: '🐛',
  info: 'ℹ️',
  error: '❌',
  warn: '⚠️',
  success: '✅',
};

/**
 * 场景专属 emoji（group / time / rainbow 复用 info 级别，故单独映射）
 */
const CONTEXT_EMOJI_MAP: Record<string, string> = {
  group: '📦',
  time: '⏱️',
  rainbow: '🌈',
};

/**
 * 获取当前时间戳字符串 [HH:MM:SS.mmm]
 */
const getTimestamp = (): string => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
};

/**
 * 构建标题前缀
 *
 * @param level 日志级别，决定基础 emoji
 * @param context 场景标识（group/time/rainbow），命中时优先使用场景专属 emoji
 */
const buildTitlePrefix = (level: LogLevel, context?: string): string => {
  let prefix = '';
  if (config.showEmoji) {
    const emoji = (context && CONTEXT_EMOJI_MAP[context]) || EMOJI_MAP[level] || '';
    prefix += `${emoji} `;
  }
  if (config.showTimestamp) {
    prefix += `[${getTimestamp()}] `;
  }
  return prefix;
};

/**
 * 快照日志内容，避免 history 钉住调用方的活引用
 *
 * 直接存原对象/数组时，调用方之后的修改会反映到历史里，
 * 且 200 条缓冲可能长期钉住大对象图无法回收。
 *
 * @param text 原始内容数组
 * @returns 可安全长期持有的浅快照（对象/数组递归复制，其余原样）
 */
const snapshotContent = (text: LogContent[]): LogContent[] => {
  return text.map((item) => {
    if (item instanceof Error || item instanceof Date || item instanceof Map || item instanceof Set) {
      // 这些类型语义上需要保持实例身份（stack / 时间 / 键值），按引用保留
      return item;
    }
    if (Array.isArray(item)) return item.slice();
    if (typeof item === 'object' && item !== null) return { ...item };
    return item;
  });
};

/**
 * 触发词动画运行时（全局单飞 + 播后冷却），模块级单例
 */
const effectsRuntime = createEffectsRuntime();

/**
 * 触发词动画检查：各输出出口在级别过滤后、console 输出前调用。
 *
 * IS_PRODUCTION 或 enabled=false 时短路；内部再查一次 enabled，
 * 防御未来新增出口漏查。动画是彩蛋，绝不影响日志链路
 * （运行时吞掉 play 的抛错，播放器任何路径都不抛错）。
 *
 * @param text 匹配用文本（escapeFormat 之前的 stringify 结果）
 */
const triggerEffects = (text: string): void => {
  if (IS_PRODUCTION) return;
  if (config.effectsEnabled === false) return;
  effectsRuntime.handle(text, config.effectOptions(), playEffectInBrowser);
};

/**
 * 格式化打印控制台日志
 * @param title 日志标题
 * @param text 日志内容数组
 * @param colors 显示颜色：fill 徽章填充、text 内容文字
 * @param level 日志级别，用于级别过滤和历史记录
 * @param context 场景标识，用于选择专属 emoji
 */
const prettyPrint = (
  title: string,
  text: LogContent[],
  colors: { fill: string; text: string },
  level: LogLevel = 'info',
  context?: string
): void => {
  // 检查日志级别
  if (!config.shouldLog(level)) return;

  // 预计算 stringify 结果，输出循环与触发词匹配共用，避免二次 stringify
  const parts = text.map(stringify);
  // 触发词匹配跑在 escapeFormat 之前，用原始内容
  if (config.effectsEnabled) triggerEffects([title, ...parts].join(' '));

  const titlePrefix = buildTitlePrefix(level, context);
  const titledTitle = escapeFormat(titlePrefix + title);

  // 初始化内容字符串，以包含标题
  let content = `%c ${titledTitle} `;
  // 遍历预计算结果，格式化每个元素并添加到内容字符串中
  for (const formattedText of parts) {
    // 内容需转义百分号，否则用户数据里的 %c/%s 会被浏览器当作格式符解析
    content = content + `\n%c ${escapeFormat(formattedText)} `;
  }
  // 初始化日志数组，用于存储格式化后的日志内容和样式
  const logs: string[] = [];
  // 将内容和标题的样式添加到日志数组中
  logs.push(content);
  logs.push(config.buildBoxStyle(colors.fill, colors.text, true));
  // 遍历文本数组，为每个元素添加相应的样式到日志数组中
  for (const item of text) {
    logs.push(config.buildBoxStyle(colors.fill, colors.text, false));
  }
  // 输出格式化后的日志到控制台
  console.log(...logs);

  // 写入历史
  config.pushHistory({
    level,
    timestamp: Date.now(),
    title,
    content: snapshotContent(text),
  });
};

/**
 * 日志工厂函数，消除 info/error/warning/success/debug 的重复代码
 *
 * @param defaultTitle 默认标题（单参数调用时使用）
 * @param role 主题角色名。传角色名而非色值字符串，使 fills[role]/texts[role]
 *   在**打印时**现查 config.theme —— 若在模块加载时把色值捕获进闭包，
 *   setTheme 将完全失效。
 */
const makeLogger =
  (defaultTitle: string, role: LevelRole, level: LogLevel) =>
  (contentOrTitle: LogContent, ...content: LogContent[]): void => {
    if (IS_PRODUCTION) return;
    const title = content.length === 0 ? defaultTitle : stringify(contentOrTitle);
    const text = content.length === 0 ? [contentOrTitle] : content;
    const theme = config.theme;
    prettyPrint(title, text, { fill: theme.fills[role], text: theme.texts[role] }, level);
  };

/**
 * 创建一个带固定前缀的日志器
 *
 * 内部复用 makeLogger 的取色规则，因此前缀 logger 与原 logger 在级别、主题、
 * emoji、级别过滤上完全一致，仅标题多一段前缀。
 *
 * @param prefix 前缀文本，如 '用户模块'
 * @returns 与标准日志函数同形状的对象（debug/info/error/warning/success/table）
 */
export const withPrefix = (prefix: string) => {
  const wrap =
    (defaultTitle: string, role: LevelRole, level: LogLevel) =>
    (contentOrTitle: LogContent, ...content: LogContent[]): void => {
      if (IS_PRODUCTION) return;
      const title = content.length === 0 ? defaultTitle : stringify(contentOrTitle);
      const text = content.length === 0 ? [contentOrTitle] : content;
      const theme = config.theme;
      prettyPrint(
        `[${prefix}] ${title}`,
        text,
        { fill: theme.fills[role], text: theme.texts[role] },
        level
      );
    };

  return {
    debug: wrap('Debug', 'debug', 'debug'),
    info: wrap('Info', 'info', 'info'),
    error: wrap('Error', 'error', 'error'),
    warning: wrap('Warning', 'warning', 'warn'),
    success: wrap('Success', 'success', 'info'),
    // 标题按现有规则拼接 [${prefix}] ${title}；守卫与渲染全量复用 table()
    table: (data: unknown, title: string = 'Table'): void => table(data, `[${prefix}] ${title}`),
  };
};

/**
 * 输出调试信息
 *
 * @param contentOrTitle 内容或标题，具体取决于后续内容参数的数量
 * @param content 可变参数，包含调试的详细信息
 */
export const debug = makeLogger('Debug', 'debug', 'debug');

/**
 * 输出信息框
 *
 * 该函数用于输出一个带有标题和内容的信息框。如果只提供一个参数，它将作为内容显示，并使用默认标题 'Info'。
 * 如果提供了多个参数，第一个参数将作为标题，其余参数作为内容显示。
 *
 * @param contentOrTitle 内容或标题，具体取决于后续内容参数的数量
 * @param content 可变参数，包含信息的详细内容
 */
export const info = makeLogger('Info', 'info', 'info');

/**
 * 输出错误信息的函数
 *
 * 该函数用于以格式化的方式输出错误信息。它接受一个参数或多个参数，并将它们分类为标题和文本，
 * 然后使用特定的颜色进行打印。这个函数的存在是为了在控制台中以一种一致且易于识别的方式展示错误信息，
 * 以便开发者快速注意到错误。
 *
 * @param contentOrTitle 错误的标题或内容，根据传入的参数数量决定其作用
 * @param content 可变参数，包含错误的详细信息
 */
export const error = makeLogger('Error', 'error', 'error');

/**
 * 显示警告信息。
 *
 * 该函数用于显示警告信息，可以接受一个或多个消息参数。如果没有提供其他消息参数，则默认标题为 'Warning'。
 * 函数会调用 `prettyPrint` 函数来格式化并显示消息。
 *
 * @param contentOrTitle 第一个消息参数，如果没有其他消息参数，则作为标题。
 * @param content 可变参数，包含警告的详细信息
 */
export const warning = makeLogger('Warning', 'warning', 'warn');

/**
 * 显示成功信息。
 *
 * 此函数接受一个标题和一个内容参数，用于在成功操作后向用户提供反馈信息。
 * 如果只提供一个参数，该参数将作为内容，标题默认为 'Success'。
 *
 * @param contentOrTitle 标题字符串，如果内容为空，则同时作为内容字符串
 * @param content 可变参数，包含成功的详细信息
 */
export const success = makeLogger('Success', 'success', 'info');

/**
 * 在控制台打印彩虹色文本
 *
 * 该函数接受一个字符串或对象作为参数，并在控制台打印出彩虹色的文本。
 * 如果传入的是对象，则会先将其转换为JSON字符串。
 *
 * @param text 要打印的文本或对象
 */
export const rainbow = (text: LogContent): void => {
  if (IS_PRODUCTION) return;
  if (!config.shouldLog('info')) return;

  // 复用 stringify 结果：触发词匹配跑在转义前，用原始内容
  const plainText = stringify(text);
  if (config.effectsEnabled) triggerEffects(plainText);

  const titlePrefix = buildTitlePrefix('info', 'rainbow');
  const formattedText = escapeFormat(plainText);
  const theme = config.theme;
  console.log(
    `%c${titlePrefix}${formattedText}`,
    `background: linear-gradient(to right, ${theme.rainbow.colors.join(', ')}); color: ${theme.rainbow.text} ; padding: 2px;`
  );

  config.pushHistory({
    level: 'info',
    timestamp: Date.now(),
    title: 'Rainbow',
    content: [text],
  });
};

/**
 * 创建一个控制台输出组，用于有组织地输出信息
 * @param title 组的标题
 * @param content 组内要输出的内容数组，可以是字符串或对象数组
 * @param expand 组默认是否展开，可选，默认为 true
 * @param color 组的颜色，可选，默认为紫色
 */
export const group = (
  title: string,
  content: LogContent[],
  expand: boolean = true,
  color?: string
): void => {
  if (IS_PRODUCTION) return;
  if (!config.shouldLog('info')) return;

  // 预计算 stringify 结果，输出循环与触发词匹配共用，避免二次 stringify
  const parts = content.map(stringify);
  // 触发词匹配跑在 escapeFormat 之前，用原始内容
  if (config.effectsEnabled) triggerEffects([title, ...parts].join(' '));

  const titlePrefix = buildTitlePrefix('info', 'group');
  // 显式 color 整段覆盖（兼容旧接口）；默认 fills.group 背景 + badgeText 字
  const theme = config.theme;
  const titleStyle =
    color !== undefined
      ? `background-color: ${color}; color: #ffffff; font-weight: bold; padding: 4px;`
      : `background-color: ${theme.fills.group}; color: ${theme.badgeText} ; font-weight: bold; padding: 4px;`;
  const bodyStyle = color !== undefined ? `color: ${color}; padding: 2px;` : `color: ${theme.texts.group} ; padding: 2px;`;

  if (expand) {
    console.group(`%c${escapeFormat(titlePrefix + title)}:`, titleStyle);
  } else {
    console.groupCollapsed(`%c${escapeFormat(titlePrefix + title)}:`, titleStyle);
  }

  // 分组输出，用 try/finally 确保 groupEnd 始终被调用
  try {
    for (const formattedText of parts) {
      console.log(`%c${escapeFormat(formattedText)}`, bodyStyle);
    }
  } finally {
    console.groupEnd();
  }

  config.pushHistory({
    level: 'info',
    timestamp: Date.now(),
    title,
    content: snapshotContent(content),
  });
};

// ================== 自绘表格（renderTable） ==================

/**
 * 表格形状分类（内部）
 *
 * - empty：空数组
 * - objects：全为非 null 对象且非数组
 * - arrays：全为数组
 * - primitives：全为原始值（含 null/undefined 元素）
 * - native：其余（混形状数组、单对象、Map/Set、原始值 data 本身），组外壳内回退 console.table
 */
type TableShape = 'empty' | 'objects' | 'arrays' | 'primitives' | 'native';

/** 单元格最大显示宽度，超出截断 */
const CELL_MAX_WIDTH = 24;

/** 格间 gutter（显示宽度 2） */
const TABLE_GUTTER = '  ';

/** 数值文本判定（着色与列对齐共用）：形如 42 / -3.14 / .5 / 1e10 */
const NUMERIC_TEXT_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * 零宽码点判定（组合符号/变体选择符/方向控制/ZWJ/不可见字符）
 *
 * 短期裁剪区间集（全量 Unicode 区间表是 defer 项，到此为止）：组合附加/扩展/补充、
 * 希伯来 niqqud（0x0591–0x05C7）、阿拉伯系（0x0610–0x061A、0x064B–0x065F、0x0670、
 * 0x06D6–0x06ED）、ZWSP/ZWNJ/ZWJ/LRM/RLM（0x200B–0x200F）、变体选择符、组合半符号、
 * FEFF。
 */
const isZeroWidthCp = (cp: number): boolean =>
  (cp >= 0x0300 && cp <= 0x036f) || // 组合附加符号
  (cp >= 0x0591 && cp <= 0x05c7) || // 希伯来 niqqud
  (cp >= 0x0610 && cp <= 0x061a) || // 阿拉伯标记
  (cp >= 0x064b && cp <= 0x065f) || // 阿拉伯变音
  cp === 0x0670 || // 阿拉伯孤立上标 alef
  (cp >= 0x06d6 && cp <= 0x06ed) || // 阿拉伯注记
  (cp >= 0x1ab0 && cp <= 0x1aff) || // 组合扩展区
  (cp >= 0x1dc0 && cp <= 0x1dff) || // 组合附加补充
  (cp >= 0x200b && cp <= 0x200f) || // ZWSP/ZWNJ/ZWJ/LRM/RLM
  (cp >= 0x20d0 && cp <= 0x20ff) || // 符号用组合
  (cp >= 0xfe00 && cp <= 0xfe0f) || // 变体选择符
  (cp >= 0xfe20 && cp <= 0xfe2f) || // 组合半符号
  cp === 0xfeff; // ZWNBSP/BOM

/**
 * 单个字符（码点）的显示宽度
 *
 * 零宽 = 0，CJK（≥ U+2E80，代理对整体走该分支）= 2，其余 = 1。
 * 零宽判定必须先于 CJK：U+FE00–U+FE2F 虽 ≥ U+2E80 但零宽。
 * ZWJ 链簇折叠不在本层（见 scanClusters）。
 */
const charWidth = (ch: string): number => {
  const cp = ch.codePointAt(0) ?? 0;
  if (isZeroWidthCp(cp)) return 0;
  return cp >= 0x2e80 ? 2 : 1;
};

/**
 * 字素簇迭代（displayWidth 与 truncateCell 共用——两者必须同簇语义）
 *
 * ZWJ 链簇：宽基符（宽 2 的码点）之间由 ZWJ 相连（链中可再夹组合符/变体选择符）
 * 视为同一字素簇，整链计 2。例：家庭 emoji（三宽基符 ZWJ 链）、technologist
 * （双宽基符 ZWJ 链）都是 2。其余簇按码点宽度累计（零宽码点计 0）。
 * visit 返回 false 时提前停止。
 */
const scanClusters = (s: string, visit: (seg: string, width: number) => boolean): void => {
  let seg = '';
  let width = 0;
  let bases = 0;
  let wideChain = false;
  let lastWide = false;
  let sawZwj = false;
  for (const ch of s) {
    const w = charWidth(ch);
    if (w === 0) {
      seg += ch;
      if (ch.codePointAt(0) === 0x200d) sawZwj = true;
      continue;
    }
    const wide = w === 2;
    if (bases > 0) {
      if (wide && lastWide && sawZwj) {
        // 宽基符间由 ZWJ（+零宽）相连：并入链
        seg += ch;
        bases += 1;
        wideChain = true;
      } else {
        if (!visit(seg, wideChain ? 2 : width)) return;
        seg = ch;
        width = w;
        bases = 1;
        wideChain = false;
      }
    } else {
      seg += ch;
      width = w;
      bases = 1;
    }
    lastWide = wide;
    sawZwj = false;
  }
  if (bases > 0) visit(seg, wideChain ? 2 : width);
  else if (seg !== '') visit(seg, 0);
};

/**
 * 显示宽度：按字素簇迭代——CJK 双宽、零宽计 0、ZWJ 链整链计 2
 */
const displayWidth = (s: string): number => {
  let width = 0;
  scanClusters(s, (_seg, w) => {
    width += w;
    return true;
  });
  return width;
};

/**
 * 按显示宽度补齐空格
 */
const padCell = (s: string, width: number, align: 'left' | 'right'): string => {
  const pad = width - displayWidth(s);
  if (pad <= 0) return s;
  return align === 'right' ? ' '.repeat(pad) + s : s + ' '.repeat(pad);
};

/**
 * 超宽截断：显示宽度 > max 时截到 max-1 显示列 + '…'（… 计 1 列）
 *
 * 按簇截断（与 displayWidth 同簇语义）：预算不把 ZWJ 链拆开按逐码点宽累计。
 */
const truncateCell = (s: string, max: number): string => {
  if (displayWidth(s) <= max) return s;
  let width = 0;
  let out = '';
  scanClusters(s, (seg, w) => {
    if (width + w > max - 1) return false;
    out += seg;
    width += w;
    return true;
  });
  return `${out}…`;
};

/**
 * 形状分类（详见 TableShape 注释）
 */
const classifyTableShape = (data: unknown): TableShape => {
  if (!Array.isArray(data)) return 'native';
  if (data.length === 0) return 'empty';
  const rows = data as unknown[];
  const isObjectRow = (v: unknown): boolean => typeof v === 'object' && v !== null && !Array.isArray(v);
  const isPrimitive = (v: unknown): boolean => typeof v !== 'object' || v === null;
  if (rows.every(isObjectRow)) return 'objects';
  if (rows.every((v) => Array.isArray(v))) return 'arrays';
  if (rows.every(isPrimitive)) return 'primitives';
  return 'native';
};

/**
 * 表格单元格（内部）
 *
 * - full：未截断 stringify 文本（history 全量用），缺键格为 ''
 * - text：显示文本 = truncateCell(full, 24)，缺键格为 ''
 * - role：着色角色——missing 缺键无类型色、null 为 null/undefined、numeric 数值、body 其余
 * - empty：列对齐判定的「空值」（缺键或 raw 为 null/undefined），不参与「全为数值」判定
 */
interface TableCell {
  full: string;
  text: string;
  role: 'missing' | 'null' | 'numeric' | 'body';
  empty: boolean;
}

/**
 * 构造单元格：stringify 一次，显示文本截断、数值判定用全量文本
 */
const makeCell = (raw: unknown): TableCell => {
  const full = stringify(raw as LogContent);
  const nullish = raw === null || raw === undefined;
  return {
    full,
    text: truncateCell(full, CELL_MAX_WIDTH),
    role: nullish ? 'null' : typeof raw === 'number' || NUMERIC_TEXT_RE.test(full) ? 'numeric' : 'body',
    empty: nullish,
  };
};

/** 缺键/缺索引单元格：空文本、无类型色 */
const MISSING_CELL: TableCell = { full: '', text: '', role: 'missing', empty: true };

/**
 * 自绘表格渲染（内部）
 *
 * 组外壳 + 表头/数据行；前置守卫（IS_PRODUCTION / 级别过滤 / 触发词）已由 table() 过。
 * 内芯按 tableMode 决定：'pretty' 自绘（默认）/ 'native' 强制原生 console.table，
 * 组外壳（含数组计数段）两种模式完全一致。
 * 颜色在调用时从 config.theme 现取，setTheme 立即生效。
 * history 写在渲染末尾，内容为未截断全量纯文本（表头+各行，'\n' 连接）。
 *
 * @param title 表名（组外壳标题与历史标题）
 * @param data 表格数据
 */
const renderTable = (title: string, data: unknown): void => {
  const theme = config.theme;
  const shape = classifyTableShape(data);
  const rows: unknown[] = Array.isArray(data) ? (data as unknown[]) : [];
  const pillStyle = `background:${theme.fills.accent};color:${theme.badgeText};font-weight:600`;
  const metaStyle = `color: ${theme.texts.meta} ;`;

  // ---- 列定义（键并集/索引列/单列）----
  // Object.keys / .length 不触发 getter；native 降级也保留，供计数段 meta 使用
  let columns: string[] = [];
  if (shape === 'objects') {
    // 各行键并集（首现顺序）
    const seen = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row as object)) {
        if (!seen.has(key)) {
          seen.add(key);
          columns.push(key);
        }
      }
    }
  } else if (shape === 'arrays') {
    // 索引列 0..maxLen-1
    let maxLen = 0;
    for (const row of rows) maxLen = Math.max(maxLen, (row as unknown[]).length);
    columns = Array.from({ length: maxLen }, (_, i) => String(i));
  } else if (shape === 'primitives') {
    // 单列 (value)
    columns = ['(value)'];
  }

  // ---- 模式判定：native 降级绕开 pretty 单元格构建 ----
  // 逃生口不共享 pretty 的 row[col] 取值脆路径（那才是抛错点），也省去 O(行×列) 白做
  const useNative = config.tableMode === 'native' || shape === 'native';

  // ---- 单元格矩阵（仅 pretty 自绘需要）----
  // 组外壳开启之前构建（pretty 路径行为不变：遇敌意 getter 仍在开壳前抛）
  let cells: TableCell[][] = [];
  if (!useNative) {
    if (shape === 'objects') {
      // 缺键格空文本、无类型色
      cells = rows.map((row) =>
        columns.map((col) =>
          Object.prototype.hasOwnProperty.call(row, col)
            ? makeCell((row as Record<string, unknown>)[col])
            : MISSING_CELL
        )
      );
    } else if (shape === 'arrays') {
      // 越界格同缺键格
      cells = rows.map((row) => {
        const arr = row as unknown[];
        return columns.map((_, i) => (i < arr.length ? makeCell(arr[i]) : MISSING_CELL));
      });
    } else if (shape === 'primitives') {
      cells = rows.map((row) => [makeCell(row)]);
    }
  }

  // ---- 组外壳 ----
  // 计数段：数组输入必有（native 形状列数不可判定，只报行数）；非数组输入省略
  let meta: string | undefined;
  if (Array.isArray(data)) {
    meta =
      shape === 'empty'
        ? '0 行 × 0 列'
        : shape === 'native'
          ? `${rows.length} 行`
          : `${rows.length} 行 × ${columns.length} 列`;
  }
  const escTitle = escapeFormat(title);
  if (meta === undefined) {
    console.group(`%c ${escTitle}`, pillStyle);
  } else {
    console.group(`%c ${escTitle} %c ${meta}`, pillStyle, metaStyle);
  }

  // ---- 内芯：pretty 自绘 / native 兜底（tableMode === 'native' 时强制原生降级） ----
  const plainLines: string[] = [];
  try {
    if (useNative) {
      console.table(data);
    } else if (columns.length > 0) {
      // 列宽 = 表头/单元格显示宽度最大值（逐行循环，不用展开传参——大数据量会撞实参上限）
      const widths = columns.map((col, j) => {
        let w = displayWidth(col);
        for (const row of cells) w = Math.max(w, displayWidth(row[j].text));
        return w;
      });
      // 右对齐当且仅当至少一个非空值且全部非空值为数值（含表头）
      const aligns: ('left' | 'right')[] = columns.map((_, j) => {
        const filled = cells.map((row) => row[j]).filter((cell) => !cell.empty);
        return filled.length > 0 && filled.every((cell) => cell.role === 'numeric') ? 'right' : 'left';
      });
      const roleColor = (role: TableCell['role']): string | undefined => {
        if (role === 'numeric') return theme.texts.warning;
        if (role === 'null') return theme.texts.null;
        if (role === 'body') return theme.texts.body;
        return undefined;
      };

      // 表头：加粗，色按 mode 取黑白
      const headerStyle = `font-weight: bold; color: ${theme.mode === 'dark' ? '#ffffff' : '#202124'} ;`;
      const headerTexts = columns.map((col, j) => ` ${padCell(col, widths[j], aligns[j])} `);
      console.log(
        headerTexts.map((t) => `%c${escapeFormat(t)}`).join(TABLE_GUTTER),
        ...headerTexts.map(() => headerStyle)
      );

      // 数据行：每行一次 console.log，每格一个 %c 段；斑马（数据行 i % 2 === 0）+ 类型色
      cells.forEach((row, i) => {
        const zebra =
          i % 2 === 0 ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.05)') : undefined;
        const texts = row.map((cell, j) => ` ${padCell(cell.text, widths[j], aligns[j])} `);
        const styles = row.map((cell) => {
          const color = roleColor(cell.role);
          if (zebra === undefined) return color === undefined ? '' : `color: ${color} ;`;
          return color === undefined ? `background: ${zebra}` : `background: ${zebra}; color: ${color} ;`;
        });
        console.log(texts.map((t) => `%c${escapeFormat(t)}`).join(TABLE_GUTTER), ...styles);
      });

      // history 全量纯文本：表头+各行（未截断、不带 padding），'\n' 连接
      plainLines.push(columns.join(TABLE_GUTTER));
      for (const row of cells) plainLines.push(row.map((cell) => cell.full).join(TABLE_GUTTER));
    }
  } finally {
    console.groupEnd();
  }

  // ---- history：title = 表名，content = 未截断全量纯文本 ----
  const plain = useNative ? stringify(data as LogContent) : plainLines.join('\n');
  config.pushHistory({ level: 'info', timestamp: Date.now(), title, content: [plain] });
};

/**
 * 将数据以自绘美化表格输出到控制台
 *
 * 形状分类见 classifyTableShape：objects 键并集列 / arrays 索引列 /
 * primitives 单列 (value) / empty 空壳；不适用自绘的形状在组外壳内
 * 回退原生 console.table（保留列排序、对象展开等交互）。
 *
 * 与其它日志函数一致：遵守日志级别过滤，并写入历史（未截断全量纯文本）。
 * setTableMode('native') 可强制回退原生 console.table（组外壳不变）。
 *
 * @param data 表格数据
 * @param title 表名（组外壳标题与历史标题），默认 'Table'
 */
export const table = (data: unknown, title: string = 'Table'): void => {
  if (IS_PRODUCTION) return;
  if (!config.shouldLog('info')) return;

  // 触发词匹配用 stringify 文本（转义前）
  if (config.effectsEnabled) triggerEffects(stringify(data as LogContent));

  renderTable(title, data);
};

/**
 * 在控制台打印一张图片
 *
 * @param url 图片 URL
 * @param scale 缩放比例，默认为 1
 * @param altText 替代文本，默认为 'image'
 */
export const picture = (url: string, scale: number = 1, altText: string = 'image'): void => {
  if (IS_PRODUCTION) return;
  if (!config.shouldLog('info')) return;

  // 调用时即匹配 altText，不等图片加载
  if (config.effectsEnabled) triggerEffects(altText);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (ctx) {
      c.width = img.width;
      c.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      const dataUri = c.toDataURL('image/png');

      console.log(
        `%c ${altText}`,
        `font-size: 1px;
          padding: ${Math.floor((img.height * scale) / 2)}px ${Math.floor((img.width * scale) / 2)}px;
          background-image: url(${dataUri});
          background-repeat: no-repeat;
          background-size: ${img.width * scale}px ${img.height * scale}px;
          color: transparent;`
      );
    }
  };
  // 添加 onerror 处理，避免图片加载失败时完全静默
  img.onerror = () => {
    console.error(`[pretty-log] Failed to load image: ${url}`);
  };
  img.src = url;
};

const timers = new Map<string, number>();

/**
 * 启动一个计时器
 *
 * @param label 计时器标签，用于标识特定的计时器
 */
export const time = (label: string = 'default'): void => {
  if (IS_PRODUCTION) return;
  if (!config.shouldLog('info')) return;

  if (timers.has(label)) {
    console.warn(`计时器 '${label}' 已存在，将被重置`);
  }
  timers.set(label, performance.now());
};

/**
 * 结束计时并输出耗时
 *
 * 默认输出两段：徽章段（titlePrefix + label，fills.accent 背景 + badgeText 字）
 * + 内容段（xx.xxms，texts.time 字）。
 *
 * @param label 计时器标签
 * @param color 显式传入时整段覆盖（兼容旧接口，沿用单段样式）
 */
export const timeEnd = (label: string = 'default', color?: string): void => {
  if (IS_PRODUCTION) return;
  // 使用 timers.has() 而非 falsy 检查，避免 startTime === 0 被误杀
  if (!timers.has(label)) {
    console.warn(`未找到计时器 '${label}'`);
    return;
  }

  const startTime = timers.get(label)!;
  const duration = performance.now() - startTime;
  timers.delete(label);

  // 触发词匹配用计时器标签（缺失计时器的 console.warn 是库诊断，不参与）
  if (config.effectsEnabled) triggerEffects(label);

  const titlePrefix = buildTitlePrefix('info', 'time');
  const elapsed = `${duration.toFixed(2)}ms`;
  if (color !== undefined) {
    // 兼容：显式 color 整段覆盖，沿用旧版单段样式
    console.log(
      `%c ${escapeFormat(titlePrefix + label)}: ${elapsed} `,
      `background: ${color}; color: white; padding: 2px 4px; border-radius: ${config.styles.borderRadius};`
    );
  } else {
    const theme = config.theme;
    console.log(
      `%c ${escapeFormat(titlePrefix + label)}: %c ${elapsed} `,
      `background: ${theme.fills.accent}; color: ${theme.badgeText} ; padding: 2px 4px; border-radius: ${config.styles.borderRadius};`,
      `color: ${theme.texts.time} ; padding: 2px 4px;`
    );
  }

  config.pushHistory({
    level: 'info',
    timestamp: Date.now(),
    title: label,
    content: [`${duration.toFixed(2)}ms`],
  });
};

/**
 * 计时并自动记录一个（异步）操作的耗时
 *
 * 相比手动 time/timeEnd，本函数用 try/finally 保证**异常路径也会结束计时**，
 * 不会因漏调用而泄漏计时器；异常本身会清理后重新抛出，不被吞掉。
 *
 * @param label 计时标签
 * @param fn 要计时的操作，接收一个 done 回调（用于异步完成通知）
 * @returns 与 fn 相同的返回值；若 fn 是同步抛错，则在清理后重新抛出
 */
export const timer = <T>(
  label: string,
  fn: (done: () => void) => T
): T => {
  if (IS_PRODUCTION) return fn(() => {});

  const start = performance.now();
  let settled = false;

  const done = (): void => {
    if (settled) return;
    settled = true;
    const duration = performance.now() - start;
    // 触发词匹配用计时标签
    if (config.effectsEnabled) triggerEffects(label);
    // 两段输出：徽章段（label）+ 内容段（耗时），与 timeEnd 默认路径一致
    const theme = config.theme;
    console.log(
      `%c ${escapeFormat(buildTitlePrefix('info', 'time') + label)}: %c ${duration.toFixed(2)}ms `,
      `background: ${theme.fills.accent}; color: ${theme.badgeText} ; padding: 2px 4px; border-radius: ${config.styles.borderRadius};`,
      `color: ${theme.texts.time} ; padding: 2px 4px;`
    );
    config.pushHistory({
      level: 'info',
      timestamp: Date.now(),
      title: label,
      content: [`${duration.toFixed(2)}ms`],
    });
  };

  try {
    const result = fn(done);
    // thenable（Promise）必须等 settle 后才结束计时；同步返回值立即结束
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      return (result as unknown as Promise<unknown>).then(
        (value) => {
          done();
          return value;
        },
        (error) => {
          done();
          throw error;
        }
      ) as T;
    }
    done();
    return result;
  } catch (error) {
    done();
    throw error;
  }
};

/**
 * 已输出过的 once 键集合
 */
const onceKeys = new Set<string>();

/**
 * 只输出一次的日志
 *
 * 适合循环体内的调试日志：同一 key 只打印一次，避免刷屏。
 * key 已输出过时本函数静默返回。
 *
 * @param key 唯一标识
 * @param contentOrTitle 内容或标题
 * @param content 可变内容参数
 */
export const once = (key: string, contentOrTitle: LogContent, ...content: LogContent[]): void => {
  if (IS_PRODUCTION) return;
  if (onceKeys.has(key)) return;
  onceKeys.add(key);

  const title = content.length === 0 ? 'Once' : stringify(contentOrTitle);
  const text = content.length === 0 ? [contentOrTitle] : content;
  const theme = config.theme;
  prettyPrint(title, text, { fill: theme.fills.info, text: theme.texts.info }, 'info');
};

/**
 * 清空 once 记录，使所有 key 可重新输出
 */
export const clearOnce = (): void => {
  onceKeys.clear();
};

/**
 * 调用计数器
 */
const counters = new Map<string, number>();

/**
 * 累计某个键的调用次数（默认不输出）
 *
 * 适合统计热点：循环里调用 count(key)，结束时用 countSummary 汇总。
 *
 * @param key 唯一标识
 */
export const count = (key: string): void => {
  if (IS_PRODUCTION) return;
  counters.set(key, (counters.get(key) ?? 0) + 1);
};

/**
 * 获取全部计数结果
 *
 * @returns 键到次数的映射
 */
export const countSummary = (): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const [key, value] of counters) {
    result[key] = value;
  }
  return result;
};

/**
 * 清空所有计数器
 */
export const clearCounters = (): void => {
  counters.clear();
};

/**
 * 断言：条件不成立时走 error 通道并抛出
 *
 * @param condition 断言条件
 * @param message 失败信息
 */
export const assert = (condition: unknown, message: string): void => {
  if (IS_PRODUCTION) return;
  if (condition) return;
  // 先用原生 console.error 输出：浏览器 DevTools 会将其标红，
  // 而 styled 的 error() 走的是 console.log，不会被标记为错误。
  console.error(`[pretty-log] Assertion Failed: ${message}`);
  error('Assertion Failed', message);
  throw new Error(message);
};

// ================== 配置 API ==================

/**
 * 配置选项接口
 */
export interface ConfigOptions {
  /** 日志级别: 'debug' | 'info' | 'warn' | 'error' | 'none' */
  logLevel?: LogLevel;
  /** 主题覆盖（与 setTheme 同形、等价合并） */
  theme?: ThemeUpdate;
  /** 是否显示 Emoji 前缀 */
  showEmoji?: boolean;
  /** 是否显示时间戳 */
  showTimestamp?: boolean;
  /** 历史记录大小，设为 0 则禁用 */
  historySize?: number;
  /** 表格渲染模式: 'pretty' | 'native'，默认 'pretty' */
  tableMode?: TableMode;
  /** 触发词动画效果配置 */
  effects?: EffectsOptions;
}

/**
 * 一次性配置所有选项
 *
 * @param options 配置选项对象
 */
export const configure = (options: ConfigOptions): void => {
  if (options.logLevel !== undefined) {
    config.logLevel = options.logLevel;
  }
  if (options.theme !== undefined) {
    config.applyTheme(options.theme);
  }
  if (options.showEmoji !== undefined) {
    config.showEmoji = options.showEmoji;
  }
  if (options.showTimestamp !== undefined) {
    config.showTimestamp = options.showTimestamp;
  }
  if (options.historySize !== undefined) {
    config.historySize = options.historySize;
  }
  if (options.tableMode !== undefined) {
    config.tableMode = options.tableMode;
  }
  if (options.effects !== undefined) {
    config.applyEffects(options.effects);
  }
};

/**
 * 设置部分样式覆盖
 *
 * 传 undefined 的项恢复默认值。
 *
 * @param partial 部分样式覆盖对象
 */
export const setStyles = (partial: Partial<Styles>): void => {
  config.applyStyles(partial);
};

/**
 * 设置日志级别
 *
 * @param level 日志级别: 'debug' | 'info' | 'warn' | 'error' | 'none'
 */
export const setLogLevel = (level: LogLevel): void => {
  config.logLevel = level;
};

/**
 * 设置主题（部分覆盖合并）
 *
 * 未提及项不动；值传 undefined 的项恢复预设默认。
 * 用户覆盖跨 mode 保留，mode 只切换未被覆盖的预设值。
 *
 * @param partial 部分主题覆盖对象
 */
export const setTheme = (partial: ThemeUpdate): void => {
  config.applyTheme(partial);
};

/**
 * 获取当前主题（P1 预设 + 用户覆盖的合并结果）
 */
export const getTheme = (): Theme => config.theme;

/**
 * 清空主题覆盖并回到环境默认（模块加载时解析的初始 mode；badgeText 同槽一并恢复默认）
 */
export const resetTheme = (): void => {
  config.resetTheme();
};

/**
 * 开关 Emoji 前缀
 *
 * @param enabled 是否启用
 */
export const showEmoji = (enabled: boolean): void => {
  config.showEmoji = enabled;
};

/**
 * 开关时间戳显示
 *
 * @param enabled 是否启用
 */
export const showTimestamp = (enabled: boolean): void => {
  config.showTimestamp = enabled;
};

/**
 * 设置历史记录大小
 *
 * @param size 历史记录条目数量，设为 0 则完全禁用
 */
export const setHistorySize = (size: number): void => {
  config.historySize = size;
};

/**
 * 设置表格渲染模式
 *
 * 'pretty' 自绘美化表格（默认）；'native' 强制回退原生 console.table
 * （保留列排序、对象展开等交互），组外壳与计数段不变。
 *
 * @param mode 表格渲染模式
 */
export const setTableMode = (mode: TableMode): void => {
  config.tableMode = mode;
};

/**
 * 获取历史日志
 *
 * @returns 历史日志条目数组
 */
export const getHistory = (): LogEntry[] => {
  if (IS_PRODUCTION) return [];
  return config.getHistory();
};

/**
 * 清空历史日志
 */
export const clearHistory = (): void => {
  config.clearHistory();
};

/**
 * 设置触发词动画效果配置（部分合并）
 *
 * 未提及（undefined）的项不动；triggers 传入即整表替换（允许 {}）。
 *
 * @param partial 部分效果配置对象
 */
export const setEffects = (partial: EffectsOptions): void => {
  config.applyEffects(partial);
};

/**
 * 获取当前效果配置
 *
 * @returns 配置副本（triggers 为浅拷贝）
 */
export const getEffects = (): Required<EffectsOptions> => {
  const options = config.effectOptions();
  return { ...options, triggers: { ...options.triggers } };
};
