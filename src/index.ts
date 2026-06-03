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
 * 日志条目，用于历史记录
 */
interface LogEntry {
  level: LogLevel;
  timestamp: number;
  title: string;
  content: LogContent[];
}

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
  private _showEmoji: boolean = false;
  private _showTimestamp: boolean = false;
  private _historySize: number = 200;
  private _history: HistoryBuffer;

  constructor() {
    this._history = new HistoryBuffer(this._historySize);
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
    this._historySize = size;
    this._history = new HistoryBuffer(size);
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

// 全局配置实例
const config = new ConfigManager();

/**
 * 将值转换为字符串表示形式
 *
 * @param value - 需要转换的值，可以是任意类型
 * @returns {string} 字符串形式的值
 *
 * 转换规则：
 * - 如果值是对象类型（不包括null），则转换为JSON字符串，使用 WeakSet 处理循环引用
 * - 否则，使用String()函数转换为字符串
 */
const stringify = (value: LogContent): string => {
  try {
    if (typeof value === 'object' && value !== null) {
      const seen = new WeakSet();
      return JSON.stringify(value, (_, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      });
    }
    return String(value);
  } catch {
    return String(value);
  }
};

/**
 * Emoji 前缀映射
 */
const EMOJI_MAP: Record<string, string> = {
  debug: '🐛',
  info: 'ℹ️',
  error: '❌',
  warning: '⚠️',
  success: '✅',
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
 */
const buildTitlePrefix = (level: LogLevel): string => {
  let prefix = '';
  if (config.showEmoji) {
    prefix += `${EMOJI_MAP[level] || ''} `;
  }
  if (config.showTimestamp) {
    prefix += `[${getTimestamp()}] `;
  }
  return prefix;
};

/**
 * 格式化打印控制台日志
 * @param title 日志标题
 * @param text 日志内容数组
 * @param color 日志的显示颜色
 * @param level 日志级别，用于级别过滤和历史记录
 */
const prettyPrint = (
  title: string,
  text: LogContent[],
  color: string,
  level: LogLevel = 'info'
): void => {
  // 检查日志级别
  if (!config.shouldLog(level)) return;

  const titlePrefix = buildTitlePrefix(level);
  const titledTitle = titlePrefix + title;

  // 初始化内容字符串，以包含标题
  let content = `%c ${titledTitle} `;
  // 遍历文本数组，格式化每个元素并添加到内容字符串中
  for (const item of text) {
    const formattedText = stringify(item);
    content = content + `\n%c ${formattedText} `;
  }
  // 初始化日志数组，用于存储格式化后的日志内容和样式
  const logs: string[] = [];
  // 将内容和标题的样式添加到日志数组中
  logs.push(content);
  logs.push(`background:${color};border:1px solid ${color}; padding: 1px; border-radius: 2px; color: #fff;`);
  // 遍历文本数组，为每个元素添加相应的样式到日志数组中
  for (const item of text) {
    logs.push(`border:1px solid ${color}; padding: 1px; border-radius: 2px; color: ${color};`);
  }
  // 输出格式化后的日志到控制台
  console.log(...logs);

  // 写入历史
  config.pushHistory({
    level,
    timestamp: Date.now(),
    title,
    content: [...text],
  });
};

/**
 * 日志工厂函数，消除 info/error/warning/success/debug 的重复代码
 */
const makeLogger =
  (defaultTitle: string, color: string, level: LogLevel) =>
  (contentOrTitle: LogContent, ...content: LogContent[]): void => {
    const title = content.length === 0 ? defaultTitle : stringify(contentOrTitle);
    const text = content.length === 0 ? [contentOrTitle] : content;
    prettyPrint(title, text, color, level);
  };

/**
 * 输出调试信息
 *
 * @param contentOrTitle 内容或标题，具体取决于后续内容参数的数量
 * @param content 可变参数，包含调试的详细信息
 */
export const debug = makeLogger('Debug', '#5BC0EB', 'debug');

/**
 * 输出信息框
 *
 * 该函数用于输出一个带有标题和内容的信息框。如果只提供一个参数，它将作为内容显示，并使用默认标题 'Info'。
 * 如果提供了多个参数，第一个参数将作为标题，其余参数作为内容显示。
 *
 * @param contentOrTitle 内容或标题，具体取决于后续内容参数的数量
 * @param content 可变参数，包含信息的详细内容
 */
export const info = makeLogger('Info', '#A6A6A6', 'info');

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
export const error = makeLogger('Error', '#EC7270', 'error');

/**
 * 显示警告信息。
 *
 * 该函数用于显示警告信息，可以接受一个或多个消息参数。如果没有提供其他消息参数，则默认标题为 'Warning'。
 * 函数会调用 `prettyPrint` 函数来格式化并显示消息。
 *
 * @param contentOrTitle 第一个消息参数，如果没有其他消息参数，则作为标题。
 * @param content 可变参数，包含警告的详细信息
 */
export const warning = makeLogger('Warning', '#F1AC6A', 'warn');

/**
 * 显示成功信息。
 *
 * 此函数接受一个标题和一个内容参数，用于在成功操作后向用户提供反馈信息。
 * 如果只提供一个参数，该参数将作为内容，标题默认为 'Success'。
 *
 * @param contentOrTitle 标题字符串，如果内容为空，则同时作为内容字符串
 * @param content 可变参数，包含成功的详细信息
 */
export const success = makeLogger('Success', '#95DA69', 'info');

/**
 * 在控制台打印彩虹色文本
 *
 * 该函数接受一个字符串或对象作为参数，并在控制台打印出彩虹色的文本。
 * 如果传入的是对象，则会先将其转换为JSON字符串。
 *
 * @param text 要打印的文本或对象
 */
export const rainbow = (text: LogContent): void => {
  if (!config.shouldLog('info')) return;

  const titlePrefix = buildTitlePrefix('info');
  let formattedText = stringify(text);
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
  if (!config.shouldLog('info')) return;

  const titlePrefix = buildTitlePrefix('info');
  const groupColor = color ?? config.theme.groupColor;

  if (expand) {
    console.group(
      `%c${titlePrefix}${title}:`,
      `background-color: ${groupColor}; color: #ffffff; font-weight: bold; padding: 4px;`
    );
  } else {
    console.groupCollapsed(
      `%c${titlePrefix}${title}:`,
      `background-color: ${groupColor}; color: #ffffff; font-weight: bold; padding: 4px;`
    );
  }

  // 分组输出，用 try/finally 确保 groupEnd 始终被调用
  try {
    for (const item of content) {
      let formattedText = stringify(item);
      console.log(`%c${formattedText}`, `color: ${groupColor}; padding: 2px;`);
    }
  } finally {
    console.groupEnd();
  }

  config.pushHistory({
    level: 'info',
    timestamp: Date.now(),
    title,
    content: [...content],
  });
};

/**
 * 将数组数据以表格形式输出到控制台
 *
 * @param data 一个任意类型的数组，其元素将被显示在表格中
 */
export const table = (data: object | unknown[]): void => {
  console.table(data);
};

/**
 * 在控制台打印一张图片
 *
 * @param url 图片 URL
 * @param scale 缩放比例，默认为 1
 * @param altText 替代文本，默认为 'image'
 */
export const picture = (url: string, scale: number = 1, altText: string = 'image'): void => {
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
  // 使用 timers.has() 而非 falsy 检查，避免 startTime === 0 被误杀
  if (!timers.has(label)) {
    console.warn(`未找到计时器 '${label}'`);
    return;
  }

  const startTime = timers.get(label)!;
  const duration = performance.now() - startTime;
  timers.delete(label);

  const timeColor = color ?? config.theme.timeColor;
  const titlePrefix = buildTitlePrefix('info');

  console.log(
    `%c ${titlePrefix}${label}: ${duration.toFixed(2)}ms `,
    `background: ${timeColor}; color: white; padding: 2px 4px; border-radius: 2px;`
  );

  config.pushHistory({
    level: 'info',
    timestamp: Date.now(),
    title: label,
    content: [`${duration.toFixed(2)}ms`],
  });
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
  return config.getHistory();
};

/**
 * 清空历史日志
 */
export const clearHistory = (): void => {
  config.clearHistory();
};
