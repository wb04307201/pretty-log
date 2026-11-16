/**
 * 核心缺陷回归测试
 *
 * 覆盖四个已确认的缺陷（修复前全部失败）：
 * - R1: setTheme 对五个日志函数完全失效（颜色在模块加载时被硬编码）
 * - R2: setHistorySize 对非法值抛 RangeError，且扩容时静默清空历史
 * - R3: stringify 把共享引用（DAG）误报为 [Circular]
 * - R4: Error / Map / Set 被打印成空对象
 *
 * 运行: yarn test:unit
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as prettyLog from '../src/index.ts'

/** 捕获一次调用期间的 console.log 输出 */
function captureLog(fn: () => void): unknown[][] {
  const captured: unknown[][] = []
  const original = console.log
  console.log = (...args: unknown[]) => {
    captured.push(args)
  }
  try {
    fn()
  } finally {
    console.log = original
  }
  return captured
}

/** 取出一条日志的首行（格式串） */
function formatString(args: unknown[]): string {
  return typeof args[0] === 'string' ? (args[0] as string) : ''
}

/** 取出一条日志的标题 CSS 样式 */
function titleStyle(args: unknown[]): string {
  const style = args.find(
    (a): a is string => typeof a === 'string' && a.includes('background')
  )
  return style ?? ''
}

/** 取出一条日志的内容 CSS 样式（单内容调用时为第二个样式实参） */
function contentStyle(args: unknown[]): string {
  return typeof args[2] === 'string' ? (args[2] as string) : ''
}

/**
 * 取历史条目的首段内容作为标识。
 * 单参数调用时 title 是默认标题（'Info' 等），内容才承载调用方传入的值。
 */
function historyContents(): string[] {
  return prettyLog.getHistory().map((entry) => String(entry.content[0]))
}

/** 把全局配置复位，避免用例之间互相污染 */
function reset(): void {
  prettyLog.configure({
    logLevel: 'debug',
    showEmoji: false,
    showTimestamp: false,
    historySize: 200,
  })
  prettyLog.resetTheme()
  prettyLog.clearHistory()
}

// ---------------------------------------------------------------- R1

test('R1: setTheme 改变五个日志函数的实际输出颜色', () => {
  reset()
  prettyLog.setTheme({
    fills: {
      info: '#00FF00',
      error: '#FF0000',
      warning: '#0000FF',
      success: '#FF00FF',
      debug: '#123456',
    },
    texts: {
      info: '#00FF00',
      error: '#FF0000',
      warning: '#0000FF',
      success: '#FF00FF',
      debug: '#123456',
    },
  })

  const cases = [
    ['info', '#00FF00'],
    ['error', '#FF0000'],
    ['warning', '#0000FF'],
    ['success', '#FF00FF'],
    ['debug', '#123456'],
  ] as const

  for (const [fn, expected] of cases) {
    const out = captureLog(() => prettyLog[fn]('标题', '内容'))
    assert.equal(out.length, 1, `${fn} 应输出一次`)
    assert.ok(
      titleStyle(out[0]).includes(expected),
      `${fn} 应使用主题填充色 ${expected}，实际样式 ${titleStyle(out[0])}`
    )
    assert.ok(
      contentStyle(out[0]).includes(expected),
      `${fn} 应使用主题文字色 ${expected}，实际样式 ${contentStyle(out[0])}`
    )
  }
})

test('R1: configure({theme}) 与 setTheme 等价', () => {
  reset()
  prettyLog.configure({ theme: { fills: { info: '#ABCDEF' } } })
  const out = captureLog(() => prettyLog.info('标题', '内容'))
  assert.ok(titleStyle(out[0]).includes('#ABCDEF'), 'configure 应同样生效')
})

// ---------------------------------------------------------------- R2

test('R2: setHistorySize 对非法输入不抛异常', () => {
  reset()
  for (const bad of [-1, 1.5, NaN, Infinity, -Infinity]) {
    assert.doesNotThrow(
      () => prettyLog.setHistorySize(bad),
      `setHistorySize(${bad}) 不应抛异常`
    )
  }
})

test('R2: setHistorySize 非法输入后历史仍可正常使用', () => {
  reset()
  prettyLog.setHistorySize(NaN)
  captureLog(() => prettyLog.info('A'))
  assert.ok(prettyLog.getHistory().length >= 1, '历史缓冲应仍可用')
})

test('R2: 调整容量保留现有历史与顺序', () => {
  reset()
  captureLog(() => {
    prettyLog.info('A')
    prettyLog.info('B')
  })
  assert.equal(prettyLog.getHistory().length, 2)

  prettyLog.setHistorySize(500)
  assert.equal(prettyLog.getHistory().length, 2, '扩容不应清空历史')
  assert.deepEqual(
    historyContents(),
    ['A', 'B'],
    '历史顺序应保持'
  )
})

test('R2: 缩容后保留最近的条目', () => {
  reset()
  captureLog(() => {
    prettyLog.info('A')
    prettyLog.info('B')
    prettyLog.info('C')
  })
  prettyLog.setHistorySize(2)
  assert.deepEqual(historyContents(), ['B', 'C'], '缩容应保留最近的条目')
})

test('R2: historySize 为 0 时禁用历史', () => {
  reset()
  prettyLog.setHistorySize(0)
  captureLog(() => prettyLog.info('A'))
  assert.equal(prettyLog.getHistory().length, 0, '0 应表示禁用历史')
})

// ---------------------------------------------------------------- R3

test('R3: 共享引用（DAG）不应被误报为循环引用', () => {
  reset()
  const shared = { id: 1 }
  const out = captureLog(() => prettyLog.info('标题', { a: shared, b: shared }))
  const printed = formatString(out[0])

  assert.ok(!printed.includes('[Circular]'), `DAG 不应出现 [Circular]，实际：${printed}`)
  assert.equal(
    (printed.match(/"id":1/g) ?? []).length,
    2,
    `共享对象应被完整打印两次，实际：${printed}`
  )
})

test('R3: 真正的循环引用仍被标记', () => {
  reset()
  const node: Record<string, unknown> = { name: 'root' }
  node.self = node
  const out = captureLog(() => prettyLog.info('标题', node))
  const printed = formatString(out[0])

  assert.ok(printed.includes('[Circular]'), `真循环应被标记，实际：${printed}`)
  assert.ok(printed.includes('root'), '循环引用的其余内容仍应打印')
})

// ---------------------------------------------------------------- R4

test('R4: Error 输出 message 与 stack，而非空对象', () => {
  reset()
  const out = captureLog(() => prettyLog.error('标题', new Error('boom')))
  const printed = formatString(out[0])

  assert.ok(!printed.includes('{}'), `Error 不应打印为空对象，实际：${printed}`)
  assert.ok(printed.includes('boom'), `Error message 应出现，实际：${printed}`)
})

test('R4: Map 输出键值条目，而非空对象', () => {
  reset()
  const out = captureLog(() => prettyLog.info('标题', new Map([['a', 1]])))
  const printed = formatString(out[0])

  assert.ok(!printed.includes('{}'), `Map 不应打印为空对象，实际：${printed}`)
  assert.ok(printed.includes('a'), `Map 的键应出现，实际：${printed}`)
})

test('R4: Set 输出元素，而非空对象', () => {
  reset()
  const out = captureLog(() => prettyLog.info('标题', new Set([1, 2])))
  const printed = formatString(out[0])

  assert.ok(!printed.includes('{}'), `Set 不应打印为空对象，实际：${printed}`)
  assert.ok(printed.includes('2'), `Set 的元素应出现，实际：${printed}`)
})

test('R4: Date 输出可读时间，而非 ISO 串', () => {
  reset()
  const out = captureLog(() => prettyLog.info('标题', new Date(0)))
  const printed = formatString(out[0])

  assert.ok(!printed.includes('1970-01-01T00:00:00.000Z'), `Date 不应直接输出 ISO 串，实际：${printed}`)
})

test('R4: 嵌套的 Date 同样输出可读时间，而非 ISO 串', () => {
  reset()
  // 回归：Date 若只在 stringify 顶层分支处理，嵌套时会被 JSON.stringify
  // 的 toJSON() 抢先转成 ISO 串，可读格式失效。
  const out = captureLog(() =>
    prettyLog.info('标题', { createdAt: new Date(0), nested: { at: new Date(0) } })
  )
  const printed = formatString(out[0])

  assert.ok(
    !printed.includes('1970-01-01T00:00:00.000Z'),
    `嵌套 Date 不应输出 ISO 串，实际：${printed}`
  )
})

test('R4: 嵌套的 Map / Set 不应退化为空对象', () => {
  reset()
  const out = captureLog(() => prettyLog.info('标题', { m: new Map([['k', 1]]), s: new Set([9]) }))
  const printed = formatString(out[0])

  assert.ok(!printed.includes('{}'), `嵌套 Map/Set 不应为空对象，实际：${printed}`)
  assert.ok(printed.includes('k'), `嵌套 Map 的键应出现，实际：${printed}`)
})