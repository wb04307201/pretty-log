/**
 * 主题模型重做（Theme / ConfigManager / 调色迁移）测试
 *
 * 覆盖（全部先于实现写就，RED 先行）：
 * - 初始 mode 环境自适应：Node 无 matchMedia 回退 light；matchMedia 探测 dark/light/抛错三径
 * - 显式 dark / light 预设全套值（getTheme()）
 * - fills/texts 局部覆盖，未提及键不动
 * - mode 切换只搬动未覆盖键，覆盖跨 mode 保留
 * - 覆盖项传 undefined 恢复默认
 * - badgeText 与 styles.titleColor 同槽
 * - resetTheme 清空覆盖并回到环境默认（模块加载时解析值）
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

test('getTheme() 显式 dark 返回 P1 dark 全套值', () => {
  reset()
  prettyLog.setTheme({ mode: 'dark' })
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

test('未设 mode 时默认 light（Node 无 matchMedia 回退浅色），light 预设全套值', () => {
  reset()
  const t = prettyLog.getTheme()
  assert.equal(t.mode, 'light')
  assert.equal(t.texts.debug, '#6366f1')
  assert.equal(t.texts.info, '#2563eb')
  assert.equal(t.texts.success, '#15803d')
  assert.equal(t.texts.warning, '#b45309')
  assert.equal(t.texts.error, '#dc2626')
  assert.equal(t.texts.group, '#6d28d9')
  assert.equal(t.texts.time, '#2563eb')
  assert.equal(t.texts.null, '#6b7280')
  assert.equal(t.texts.meta, '#5f6368')
  assert.equal(t.texts.body, '#3c4043')
})

// ---------------------------------------------------------------- 2 局部覆盖

test('fills/texts 局部覆盖，未提及键不动', () => {
  reset()
  // 本用例钉 dark 预设值，显式固定 mode（默认 mode 已改环境自适应）
  prettyLog.setTheme({ mode: 'dark' })
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
  // 针脚依赖 buildBoxStyle 的 `color: 值 ;` 空格格式（保留该格式是裁定，勿「清理」）
  assert.ok(
    styleOf(out2.log[0], ' #1f2330 ').includes(' #1f2330 '),
    `badgeText 传 undefined 应恢复 #1f2330，实际：${styleOf(out2.log[0], 'color')}`
  )
})

// ---------------------------------------------------------------- 6 resetTheme

test('resetTheme 清空覆盖并回到环境默认（Node 下 light），不固定 dark', () => {
  reset()
  prettyLog.setTheme({
    mode: 'dark',
    badgeText: 'gold',
    fills: { info: '#00FF00' },
    texts: { info: 'red' },
    rainbow: { colors: ['#ffffff'], text: 'blue' },
  })
  prettyLog.resetTheme()
  const t = prettyLog.getTheme()
  assert.equal(t.mode, 'light')
  assert.equal(t.fills.info, '#93c5fd')
  assert.equal(t.texts.info, '#2563eb')
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

// ---------------------------------------------------------------- 9 rainbow 空色组（M-8）

test('rainbow.colors 传空数组视同 undefined，恢复默认五色（M-8）', () => {
  reset()
  prettyLog.setTheme({ rainbow: { colors: ['#ffffff'] } })
  prettyLog.setTheme({ rainbow: { colors: [] } })
  assert.deepEqual(
    prettyLog.getTheme().rainbow.colors,
    ['#f9a8d4', '#c4b5fd', '#93c5fd', '#6ee7b7', '#fde68a'],
    '空数组应恢复默认五色（覆盖层不存空数组）'
  )

  const out = capture(() => prettyLog.rainbow('x'))
  const style = styleOf(out.log[0], 'linear-gradient')
  assert.ok(style.includes('#f9a8d4'), `样式应含默认五色首色，实际：${style}`)
  assert.ok(!style.includes('to right, )'), `不得生成非法 CSS（空渐变表），实际：${style}`)
})

// -------------------------------- 10 初始 mode 自动解析（R15 缓存穿透动态 import）

test('初始 mode 自动解析：matchMedia(prefers-color-scheme: dark) matches:true → dark', async () => {
  ;(globalThis as Record<string, unknown>).window = {
    matchMedia: (q: string) => ({ matches: q.includes('dark') }),
  }
  try {
    // 缓存穿透：初始 mode 在模块加载时解析一次，须强制重新求值模块才能测到解析路径
    const mod = await import(`../src/index.ts?mm=dark-${Date.now()}`)
    assert.equal(mod.getTheme().mode, 'dark')
  } finally {
    delete (globalThis as Record<string, unknown>).window
  }
})

test('初始 mode 自动解析：matchMedia matches:false → light', async () => {
  ;(globalThis as Record<string, unknown>).window = {
    matchMedia: () => ({ matches: false }),
  }
  try {
    const mod = await import(`../src/index.ts?mm=light-${Date.now()}`)
    assert.equal(mod.getTheme().mode, 'light')
  } finally {
    delete (globalThis as Record<string, unknown>).window
  }
})

test('初始 mode 自动解析：window 在场但 matchMedia 抛错 → 回退 light', async () => {
  ;(globalThis as Record<string, unknown>).window = {
    matchMedia: () => {
      throw new Error('matchMedia 不可用')
    },
  }
  try {
    const mod = await import(`../src/index.ts?mm=throw-${Date.now()}`)
    assert.equal(mod.getTheme().mode, 'light')
  } finally {
    delete (globalThis as Record<string, unknown>).window
  }
})
