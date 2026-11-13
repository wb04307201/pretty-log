/**
 * 主题模型重做（Theme / ConfigManager / 调色迁移）测试
 *
 * 覆盖（全部先于实现写就，RED 先行）：
 * - getTheme() 默认返回 P1 dark 全套值
 * - fills/texts 局部覆盖，未提及键不动
 * - mode 切换只搬动未覆盖键，覆盖跨 mode 保留
 * - 覆盖项传 undefined 恢复默认
 * - badgeText 与 styles.titleColor 同槽
 * - resetTheme 清空覆盖并回到 dark
 * - configure({ theme }) 与 setTheme 等价合并
 * - 调用时取色（R1 回归）
 *
 * 运行: node --experimental-strip-types --test test/theme.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as prettyLog from '../src/index.ts'

/** 捕获一次调用期间的 console 输出（含 log/warn/error/group/groupEnd/table） */
function capture(fn: () => void): Record<string, unknown[][]> {
  const cap: Record<string, unknown[][]> = {}
  const methods = [
    'log',
    'warn',
    'error',
    'group',
    'groupCollapsed',
    'groupEnd',
    'table',
  ] as const
  const originals = methods.map((m) => [m, console[m]] as const)
  for (const m of methods) {
    cap[m] = []
    console[m] = ((...args: unknown[]) => {
      cap[m].push(args)
    }) as unknown as typeof console.log
  }
  try {
    fn()
  } finally {
    for (const [m, orig] of originals) console[m] = orig
  }
  return cap
}

/** 取一条 console.log 实参中含指定关键字的样式串 */
function styleOf(args: unknown[], needle: string): string {
  const hit = args.find((a): a is string => typeof a === 'string' && a.includes(needle))
  return hit ?? ''
}

/** 复位全局主题，避免用例互相污染 */
function reset(): void {
  prettyLog.resetTheme()
  prettyLog.clearHistory()
}

// ---------------------------------------------------------------- 1 默认值

test('getTheme() 默认返回 P1 dark 全套值', () => {
  reset()
  const t = prettyLog.getTheme()
  assert.equal(t.mode, 'dark')
  assert.equal(t.fills.info, '#93c5fd')
  assert.equal(t.fills.accent, '#93c5fd')
  assert.equal(t.texts.body, '#e8eaed')
  assert.equal(t.texts.warning, '#fde68a')
  assert.equal(t.badgeText, '#1f2330')
  assert.deepEqual(t.rainbow.colors, [
    '#f9a8d4',
    '#c4b5fd',
    '#93c5fd',
    '#6ee7b7',
    '#fde68a',
  ])
  assert.equal(t.rainbow.text, '#23273a')
})

// ---------------------------------------------------------------- 2 局部覆盖

test('fills/texts 局部覆盖，未提及键不动', () => {
  reset()
  prettyLog.setTheme({ fills: { info: '#00FF00' } })
  let t = prettyLog.getTheme()
  assert.equal(t.fills.info, '#00FF00')
  assert.equal(t.fills.error, '#fca5a5')

  prettyLog.setTheme({ texts: { info: 'red' } })
  t = prettyLog.getTheme()
  assert.equal(t.texts.info, 'red')
  assert.equal(t.texts.warning, '#fde68a')
})

// ---------------------------------------------------------------- 3 mode 与覆盖

test('mode 切换只搬动未覆盖键', () => {
  reset()
  prettyLog.setTheme({ mode: 'light' })
  let t = prettyLog.getTheme()
  assert.equal(t.texts.info, '#2563eb')
  assert.equal(t.texts.warning, '#b45309')

  // 覆盖跨 mode 保留：texts.info 的覆盖在切回 dark 后仍是 'red'
  prettyLog.setTheme({ texts: { info: 'red' }, mode: 'dark' })
  t = prettyLog.getTheme()
  assert.equal(t.texts.info, 'red')
  assert.equal(t.texts.warning, '#fde68a')
})

// ---------------------------------------------------------------- 4 undefined 恢复默认

test('覆盖项传 undefined 恢复默认', () => {
  reset()
  prettyLog.setTheme({ fills: { info: '#00FF00' } })
  prettyLog.setTheme({ fills: { info: undefined } })
  assert.equal(prettyLog.getTheme().fills.info, '#93c5fd')
})

// ---------------------------------------------------------------- 5 badgeText 同槽

test('badgeText 与 styles.titleColor 同槽', () => {
  reset()
  prettyLog.setStyles({ titleColor: 'gold' })
  assert.equal(prettyLog.getTheme().badgeText, 'gold')

  prettyLog.setTheme({ badgeText: 'silver' })
  const out = capture(() => prettyLog.info('标题', '内容'))
  assert.ok(
    styleOf(out.log[0], 'silver').includes('silver'),
    `setTheme({ badgeText }) 应写进输出样式，实际：${styleOf(out.log[0], 'silver')}`
  )

  prettyLog.setTheme({ badgeText: undefined })
  assert.equal(prettyLog.getTheme().badgeText, '#1f2330')
  const out2 = capture(() => prettyLog.info('标题', '内容'))
  assert.ok(
    styleOf(out2.log[0], ' #1f2330 ').includes(' #1f2330 '),
    `badgeText 传 undefined 应恢复 #1f2330，实际：${styleOf(out2.log[0], 'color')}`
  )
})

// ---------------------------------------------------------------- 6 resetTheme

test('resetTheme 清空覆盖并回到 dark', () => {
  reset()
  prettyLog.setTheme({
    mode: 'light',
    badgeText: 'gold',
    fills: { info: '#00FF00' },
    texts: { info: 'red' },
    rainbow: { colors: ['#ffffff'], text: 'blue' },
  })
  prettyLog.resetTheme()
  const t = prettyLog.getTheme()
  assert.equal(t.mode, 'dark')
  assert.equal(t.fills.info, '#93c5fd')
  assert.equal(t.texts.info, '#93c5fd')
  assert.equal(t.badgeText, '#1f2330')
  assert.deepEqual(t.rainbow.colors, [
    '#f9a8d4',
    '#c4b5fd',
    '#93c5fd',
    '#6ee7b7',
    '#fde68a',
  ])
  assert.equal(t.rainbow.text, '#23273a')
})

// ---------------------------------------------------------------- 7 configure 等价

test('configure({ theme }) 与 setTheme 等价合并', () => {
  reset()
  prettyLog.setTheme({ fills: { info: '#00FF00' } })
  prettyLog.configure({ theme: { fills: { error: '#FF0000' } } })
  const t = prettyLog.getTheme()
  assert.equal(t.fills.info, '#00FF00', 'configure 不应清掉 setTheme 的覆盖')
  assert.equal(t.fills.error, '#FF0000')
})

// ---------------------------------------------------------------- 8 调用时取色（R1 回归）

test('调用时取色（R1 回归）', () => {
  reset()
  prettyLog.setTheme({ fills: { info: '#00FF00' } })
  const out = capture(() => prettyLog.info('标题', '内容'))
  const style = styleOf(out.log[0], 'background')
  assert.ok(
    style.includes('background:#00FF00'),
    `info 应在调用时取覆盖色 #00FF00，实际：${style}`
  )
})
