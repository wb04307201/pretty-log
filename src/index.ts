import {
  DEFAULT_EFFECT_TRIGGERS,
  DEFAULT_EFFECT_COOLDOWN_MS,
  type EffectType,
  type EffectsOptions,
} from './effects.ts';

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
 * 主题颜色配置
 */
export interface Theme {
  infoColor: string;
  errorColor: string;
  warningColor: string;
  successColor: string;
  debugColor: string;
  groupColor: string;
  timeColor: string;
}

/**
 * 默认主题
 */
const DEFAULT_THEME: Theme = {
  infoColor: '#A6A6A6',
  errorColor: '#EC7270',
  warningColor: '#F1AC6A',
  successColor: '#95DA69',
  debugColor: '#5BC0EB',
  groupColor: '#7B79E8',
  timeColor: '#7B79E8',
};

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
  /** 标题文字颜色，默认 '#fff' */
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
  titleColor: '#fff',
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
 * 配置管理器
 */
class ConfigManager {
  private _logLevel: LogLevel = 'debug';
  private _theme: Theme = { ...DEFAULT_THEME };
  private _styles: Required<Styles> = { ...DEFAULT_STYLES };
  private _showEmoji: boolean = false;
  private _showTimestamp: boolean = false;
  private _historySize: number = DEFAULT_HISTORY_SIZE;
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
   * @param color 边框/背景色
   * @param isTitle true 为标题样式（带背景），false 为内容样式（仅边框）
   */
  buildBoxStyle(color: string, isTitle: boolean): string {
    const s = this._styles;
    const border = `${s.borderWidth} ${s.borderStyle} ${color}`;
    return isTitle
      ? `background:${color};border:${border}; padding: ${s.padding}; border-radius: ${s.borderRadius}; color: ${s.titleColor};`
      : `border:${border}; padding: ${s.padding}; border-radius: ${s.borderRadius}; color: ${color};`;
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

  get theme(): Theme {
    return { ...this._theme };
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
   * 合并部分主题覆盖
   */
  applyTheme(partial: Partial<Theme>): void {
    for (const key of Object.keys(partial) as (keyof Theme)[]) {
      this._theme[key] = partial[key]!;
    }
  }

  /**
   * 合并部分效果配置：只处理显式提供（!== undefined）的项；
   * triggers 传入即整表替换（允许 {}），未提及项不动
   */
  applyEffects(partial: EffectsOptions): void {
    if (partial.enabled !== undefined) this._effectsEnabled = partial.enabled;
    if (partial.cooldownMs !== undefined) this._effectCooldownMs = partial.cooldownMs;
    if (partial.triggers !== undefined) this._effectTriggers = { ...partial.triggers };
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
 * 格式化打印控制台日志
 * @param title 日志标题
 * @param text 日志内容数组
 * @param color 日志的显示颜色
 * @param level 日志级别，用于级别过滤和历史记录
 * @param context 场景标识，用于选择专属 emoji
 */
const prettyPrint = (
  title: string,
  text: LogContent[],
  color: string,
  level: LogLevel = 'info',
  context?: string
): void => {
  // 检查日志级别
  if (!config.shouldLog(level)) return;

  const titlePrefix = buildTitlePrefix(level, context);
  const titledTitle = escapeFormat(titlePrefix + title);

  // 初始化内容字符串，以包含标题
  let content = `%c ${titledTitle} `;
  // 遍历文本数组，格式化每个元素并添加到内容字符串中
  for (const item of text) {
    // 内容需转义百分号，否则用户数据里的 %c/%s 会被浏览器当作格式符解析
    const formattedText = escapeFormat(stringify(item));
    content = content + `\n%c ${formattedText} `;
  }
  // 初始化日志数组，用于存储格式化后的日志内容和样式
  const logs: string[] = [];
  // 将内容和标题的样式添加到日志数组中
  logs.push(content);
  logs.push(config.buildBoxStyle(color, true));
  // 遍历文本数组，为每个元素添加相应的样式到日志数组中
  for (const item of text) {
    logs.push(config.buildBoxStyle(color, false));
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
 * @param colorKey 主题颜色字段名。传字段名而非色值字符串，使颜色在**打印时**
 *   现查 config.theme —— 若在模块加载时把色值捕获进闭包，setTheme 将完全失效。
 *   theme 中不存在该字段时回退到 fallbackColor，保证主题被清空也不会丢色。
 */
const makeLogger =
  (defaultTitle: string, colorKey: keyof Theme, fallbackColor: string, level: LogLevel) =>
  (contentOrTitle: LogContent, ...content: LogContent[]): void => {
    if (IS_PRODUCTION) return;
    const title = content.length === 0 ? defaultTitle : stringify(contentOrTitle);
    const text = content.length === 0 ? [contentOrTitle] : content;
    prettyPrint(title, text, config.theme[colorKey] ?? fallbackColor, level);
  };

/**
 * 创建一个带固定前缀的日志器
 *
 * 内部复用 makeLogger，因此前缀 logger 与原 logger 在级别、主题、emoji、
 * 级别过滤上完全一致，仅标题多一段前缀。
 *
 * @param prefix 前缀文本，如 '用户模块'
 * @returns 与标准日志函数同形状的对象（debug/info/error/warning/success）
 */
export const withPrefix = (prefix: string) => {
  const wrap =
    (defaultTitle: string, colorKey: keyof Theme, fallbackColor: string, level: LogLevel) =>
    (contentOrTitle: LogContent, ...content: LogContent[]): void => {
      if (IS_PRODUCTION) return;
      const title = content.length === 0 ? defaultTitle : stringify(contentOrTitle);
      const text = content.length === 0 ? [contentOrTitle] : content;
      prettyPrint(
        `[${prefix}] ${title}`,
        text,
        config.theme[colorKey] ?? fallbackColor,
        level
      );
    };

  return {
    debug: wrap('Debug', 'debugColor', '#5BC0EB', 'debug'),
    info: wrap('Info', 'infoColor', '#A6A6A6', 'info'),
    error: wrap('Error', 'errorColor', '#EC7270', 'error'),
    warning: wrap('Warning', 'warningColor', '#F1AC6A', 'warn'),
    success: wrap('Success', 'successColor', '#95DA69', 'info'),
  };
};

/**
 * 输出调试信息
 *
 * @param contentOrTitle 内容或标题，具体取决于后续内容参数的数量
 * @param content 可变参数，包含调试的详细信息
 */
export const debug = makeLogger('Debug', 'debugColor', '#5BC0EB', 'debug');

/**
 * 输出信息框
 *
 * 该函数用于输出一个带有标题和内容的信息框。如果只提供一个参数，它将作为内容显示，并使用默认标题 'Info'。
 * 如果提供了多个参数，第一个参数将作为标题，其余参数作为内容显示。
 *
 * @param contentOrTitle 内容或标题，具体取决于后续内容参数的数量
 * @param content 可变参数，包含信息的详细内容
 */
export const info = makeLogger('Info', 'infoColor', '#A6A6A6', 'info');

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
export const error = makeLogger('Error', 'errorColor', '#EC7270', 'error');

/**
 * 显示警告信息。
 *
 * 该函数用于显示警告信息，可以接受一个或多个消息参数。如果没有提供其他消息参数，则默认标题为 'Warning'。
 * 函数会调用 `prettyPrint` 函数来格式化并显示消息。
 *
 * @param contentOrTitle 第一个消息参数，如果没有其他消息参数，则作为标题。
 * @param content 可变参数，包含警告的详细信息
 */
export const warning = makeLogger('Warning', 'warningColor', '#F1AC6A', 'warn');

/**
 * 显示成功信息。
 *
 * 此函数接受一个标题和一个内容参数，用于在成功操作后向用户提供反馈信息。
 * 如果只提供一个参数，该参数将作为内容，标题默认为 'Success'。
 *
 * @param contentOrTitle 标题字符串，如果内容为空，则同时作为内容字符串
 * @param content 可变参数，包含成功的详细信息
 */
export const success = makeLogger('Success', 'successColor', '#95DA69', 'info');

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

  const titlePrefix = buildTitlePrefix('info', 'rainbow');
  const formattedText = escapeFormat(stringify(text));
  console.log(
    `%c${titlePrefix}${formattedText}`,
    'background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet); color: white; padding: 2px;'
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

  const titlePrefix = buildTitlePrefix('info', 'group');
  const groupColor = color ?? config.theme.groupColor;

  if (expand) {
    console.group(
      `%c${escapeFormat(titlePrefix + title)}:`,
      `background-color: ${groupColor}; color: #ffffff; font-weight: bold; padding: 4px;`
    );
  } else {
    console.groupCollapsed(
      `%c${escapeFormat(titlePrefix + title)}:`,
      `background-color: ${groupColor}; color: #ffffff; font-weight: bold; padding: 4px;`
    );
  }

  // 分组输出，用 try/finally 确保 groupEnd 始终被调用
  try {
    for (const item of content) {
      const formattedText = escapeFormat(stringify(item));
      console.log(`%c${formattedText}`, `color: ${groupColor}; padding: 2px;`);
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

/**
 * 将数组数据以表格形式输出到控制台
 *
 * 与其它日志函数一致：遵守日志级别过滤，并写入历史。
 *
 * @param data 一个任意类型的数组，其元素将被显示在表格中
 */
export const table = (data: object | unknown[]): void => {
  if (IS_PRODUCTION) return;
  if (!config.shouldLog('info')) return;

  console.table(data);

  const rows = Array.isArray(data) ? data : [data];
  config.pushHistory({
    level: 'info',
    timestamp: Date.now(),
    title: 'Table',
    content: [`${rows.length} 行`],
  });
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
 * @param label 计时器标签
 * @param color 输出颜色，默认为紫色
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

  const timeColor = color ?? config.theme.timeColor;
  const titlePrefix = buildTitlePrefix('info', 'time');

  console.log(
    `%c ${escapeFormat(titlePrefix + label)}: ${duration.toFixed(2)}ms `,
    `background: ${timeColor}; color: white; padding: 2px 4px; border-radius: ${config.styles.borderRadius};`
  );

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
    const timeColor = config.theme.timeColor;
    console.log(
      `%c ${escapeFormat(buildTitlePrefix('info', 'time') + label)}: ${duration.toFixed(2)}ms `,
      `background: ${timeColor}; color: white; padding: 2px 4px; border-radius: ${config.styles.borderRadius};`
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
  prettyPrint(title, text, config.theme.infoColor, 'info');
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
  /** 主题颜色覆盖 */
  theme?: Partial<Theme>;
  /** 是否显示 Emoji 前缀 */
  showEmoji?: boolean;
  /** 是否显示时间戳 */
  showTimestamp?: boolean;
  /** 历史记录大小，设为 0 则禁用 */
  historySize?: number;
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
 * 设置主题颜色
 *
 * @param partial 部分主题覆盖对象
 */
export const setTheme = (partial: Partial<Theme>): void => {
  config.applyTheme(partial);
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
