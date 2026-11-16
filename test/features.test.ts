/**
 * 剩余缺陷修复 + 新功能的回归测试
 *
 * 覆盖（全部先于实现写就，RED 先行）：
 * - R5:  用户内容中的 %c / %s 被当作格式符，样式错位
 * - R6:  EMOJI_MAP 键名 'warning' 与实际 level 'warn' 不匹配，警告无 emoji；
 *        group/time/rainbow 传 'info'，导致 📦/⏱️/🌈 永远打不出来
 * - R7:  history 持有调用方活引用，200 条缓冲可钉住大对象图
 * - R8:  table() 不走级别过滤、也不写历史
 * - R9:  异步 timer：finally 保证异常路径也 timeEnd
 * - R10: once：同 key 只打一次
 * - R11: count：累计次数并可汇总
 * - R12: withPrefix：返回带固定前缀的 logger
 * - R13: assert：失败时走 error 通道并抛出
 * - R14: setStyles：可覆盖硬编码样式
 * - R15: 生产环境剥离（NODE_ENV=production 时整体 no-op）
 *
 * 运行: yarn test:unit
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as prettyLog from '../src/index.ts'

/** 捕获一次调用期间的 console 输出（含 log/warn/error/group/table 等） */
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

/** 取一条 console.log 的格式串 */
function fmt(args: unknown[]): string {
  return typeof args[0] === 'string' ? (args[0] as string) : ''
}

/** 取一条 console.log 中含指定关键字的样式串 */
function styleOf(args: unknown[], needle: string): string {
  const hit = args.find((a): a is string => typeof a === 'string' && a.includes(needle))
  return hit ?? ''
}

/** 复位全局配置，避免用例互相污染 */
function reset(): void {
  prettyLog.configure({
    logLevel: 'debug',
    showEmoji: false,
    showTimestamp: false,
    historySize: 200,
  })
  prettyLog.resetTheme()
  prettyLog.clearHistory()
  prettyLog.clearOnce()
  prettyLog.clearCounters()
}

// ---------------------------------------------------------------- R5 格式串注入

test('R5: 内容中的 %c 被转义，不再被浏览器当作格式符', () => {
  reset()
  const out = capture(() => prettyLog.info('标题', '%c INJECT'))
  const f = fmt(out.log[0])

  // 转义后内容行应为 "%%c INJECT"（末尾空格来自 prettyPrint 的排版模板）；
  // 若未转义则会多消耗一个 CSS 实参导致样式错位
  const contentLine = (f.split('\n')[1] ?? '').replace(/^%c /, '').trim()
  assert.equal(contentLine, '%%c INJECT', `内容中的 %c 应被转义为 %%，实际：${contentLine}`)
  // 实参数量必须与内容条目数一致（标题1 + 内容1 = 2 个 CSS 实参）
  assert.equal(out.log[0].length, 3, `实参数量应保持一致，实际：${out.log[0].length}`)
})

test('R5: 内容中的 %s 不再错位样式实参', () => {
  reset()
  // 一条内容 + 一个标题样式 + 一个内容样式 = 3 个实参。
  // 若内容里的 %s 生效，会多消耗一个实参，导致样式整体错位。
  const out = capture(() => prettyLog.info('标题', '100% %s done'))
  assert.equal(out.log[0].length, 3, `实参数量应与内容条目数一致，实际：${out.log[0].length}`)
})

test('R5: 百分号本身也能正确打印', () => {
  reset()
  const out = capture(() => prettyLog.info('标题', '完成 50%'))
  assert.ok(fmt(out.log[0]).includes('50%'), `普通百分号应原样显示，实际：${fmt(out.log[0])}`)
})

// ---------------------------------------------------------------- R6 emoji

test('R6: warning 在 showEmoji 下能取到 emoji', () => {
  reset()
  prettyLog.showEmoji(true)
  const out = capture(() => prettyLog.warning('标题', '内容'))
  assert.ok(fmt(out.log[0]).includes('⚠️'), `warning 应带 ⚠️，实际：${fmt(out.log[0])}`)
})

test('R6: group / timeEnd / rainbow 的专属 emoji 可被打出', () => {
  reset()
  prettyLog.showEmoji(true)

  // group 标题走 console.group，不是 console.log
  const g = capture(() => prettyLog.group('标题', ['内容']))
  assert.ok(fmt(g.group[0]).includes('📦'), `group 应带 📦，实际：${fmt(g.group[0])}`)

  const t = capture(() => {
    prettyLog.time('t')
    prettyLog.timeEnd('t')
  })
  // 针脚依赖徽章 label 的 `t:` 冒号格式（保留该格式是裁定，勿「清理」）
  const timeLine = t.log.map(fmt).find((s) => s.includes('t:'))
  assert.ok(timeLine?.includes('⏱️'), `timeEnd 应带 ⏱️，实际：${timeLine}`)

  const r = capture(() => prettyLog.rainbow('文本'))
  assert.ok(fmt(r.log[0]).includes('🌈'), `rainbow 应带 🌈，实际：${fmt(r.log[0])}`)
})

// ---------------------------------------------------------------- R7 history 活引用

test('R7: history 快照调用方的后续修改（不钉住活引用）', () => {
  reset()
  const live = { mutable: 1 }
  capture(() => prettyLog.info('标题', live))
  live.mutable = 999

  const entry = prettyLog.getHistory().slice(-1)[0]
  const stored = entry.content[0]
  if (typeof stored === 'object' && stored !== null) {
    assert.notEqual(
      (stored as { mutable?: number }).mutable,
      999,
      'history 不应持有调用方对象的活引用'
    )
  }
})

// ---------------------------------------------------------------- R8 table

test('R8: table 遵守日志级别过滤', () => {
  reset()
  prettyLog.setLogLevel('error')
  const out = capture(() => prettyLog.table([{ a: 1 }]))
  assert.equal(out.log.length, 0, 'logLevel=error 时 table 不应输出')
})

test('R8: table 写入历史（title=表名、内容为未截断全量文本）', () => {
  reset()
  const long = 'x'.repeat(30)
  capture(() => prettyLog.table([{ a: long }], 'R8 表'))
  const entry = prettyLog.getHistory().slice(-1)[0]
  assert.equal(entry.title, 'R8 表', '历史 title 应为表名')
  assert.equal(entry.content[0], `a\n${long}`, '历史内容应为未截断全量纯文本（表头+各行）')
})

// ---------------------------------------------------------------- R9 timer

test('R9: timer 在正常路径结束并输出耗时', async () => {
  reset()
  const out = capture(() => {
    void prettyLog.timer('异步任务', () => Promise.resolve('ok'))
  })
  assert.equal(out.log.length, 0, '开始时不应立即输出')

  await new Promise((r) => setTimeout(r, 30))
  const after = prettyLog.getHistory()
  assert.ok(
    after.some((e) => e.title.includes('异步任务')),
    `timer 应写入历史，实际：${JSON.stringify(after.map((e) => e.title))}`
  )
})

test('R9: timer 在抛异常的路径上依然结束并重新抛出', async () => {
  reset()

  // 同步抛错：timer 应在清理计时后把原异常原样抛回，而不是吞掉
  assert.throws(
    () =>
      prettyLog.timer('会炸的任务', () => {
        throw new Error('boom')
      }),
    /boom/,
    '原始异常应向上抛出，不被 timer 吞掉'
  )

  // 异常路径也必须结束计时，否则计时器泄漏
  const titles = prettyLog.getHistory().map((e) => e.title)
  assert.ok(
    titles.includes('会炸的任务'),
    `异常路径也应结束计时，实际：${JSON.stringify(titles)}`
  )
})

test('R9: timer 在 Promise reject 的路径上结束并继续 reject', async () => {
  reset()

  await assert.rejects(
    () => prettyLog.timer('异步失败', () => Promise.reject(new Error('async boom'))),
    /async boom/,
    '异步异常应向上传递'
  )

  const titles = prettyLog.getHistory().map((e) => e.title)
  assert.ok(
    titles.includes('异步失败'),
    `异步异常路径也应结束计时，实际：${JSON.stringify(titles)}`
  )
})

test('R9: timer 重复 label 会自动清理，不残留', async () => {
  reset()
  await prettyLog.timer('同名', () => Promise.resolve(1))
  await prettyLog.timer('同名', () => Promise.resolve(2))
  // 第二次同名计时器不应因"已存在"而报重置警告
  const titles = prettyLog.getHistory().map((e) => e.title)
  assert.ok(titles.filter((t) => t.includes('同名')).length >= 2, '两次都应完成计时')
})

// ---------------------------------------------------------------- R10 once

test('R10: once 同 key 只输出一次', () => {
  reset()
  const out = capture(() => {
    for (let i = 0; i < 5; i++) prettyLog.once('重复键', '消息', i)
  })
  assert.equal(out.log.length, 1, `应只输出一次，实际 ${out.log.length} 次`)
})

test('R10: 不同 key 各自输出一次', () => {
  reset()
  const out = capture(() => {
    prettyLog.once('键A', 'a')
    prettyLog.once('键B', 'b')
    prettyLog.once('键A', 'a2')
  })
  assert.equal(out.log.length, 2, '两个 key 应各输出一次')
})

test('R10: clearOnce 后可重新输出', () => {
  reset()
  capture(() => {
    prettyLog.once('k', 'x')
    prettyLog.once('k', 'y')
  })
  const again = capture(() => {
    prettyLog.clearOnce()
    prettyLog.once('k', 'z')
  })
  assert.equal(again.log.length, 1, 'clearOnce 后应能重新输出')
})

// ---------------------------------------------------------------- R11 count

test('R11: count 累计并可用 countSummary 汇总', () => {
  reset()
  capture(() => {
    for (let i = 0; i < 3; i++) prettyLog.count('接口A')
  })
  assert.equal(prettyLog.countSummary().接口A, 3, '应累计为 3')
})

test('R11: clearCounters 后归零', () => {
  reset()
  capture(() => {
    prettyLog.count('x')
    prettyLog.count('x')
  })
  prettyLog.clearCounters()
  assert.deepEqual(prettyLog.countSummary(), {}, '清空后不应有残留')
})

// ---------------------------------------------------------------- R12 withPrefix

test('R12: withPrefix 返回的 logger 自动带上前缀', () => {
  reset()
  const userLog = prettyLog.withPrefix('用户模块')
  const out = capture(() => userLog.info('标题', '内容'))
  assert.ok(fmt(out.log[0]).includes('用户模块'), `应包含前缀，实际：${fmt(out.log[0])}`)
})

test('R12: withPrefix 保持底层日志级别与主题', () => {
  reset()
  prettyLog.setTheme({ fills: { info: '#00FF00' } })
  const userLog = prettyLog.withPrefix('P')
  const out = capture(() => userLog.info('标题', '内容'))
  assert.ok(
    styleOf(out.log[0], 'background').includes('#00FF00'),
    '前缀 logger 应沿用主题色'
  )
})

// ---------------------------------------------------------------- R13 assert

test('R13: assert 条件为真时不输出', () => {
  reset()
  const out = capture(() => prettyLog.assert(true, '不应出现'))
  assert.equal(out.log.length + out.error.length, 0, '条件成立应静默')
})

test('R13: assert 条件为假时抛出并走 error 通道', () => {
  reset()
  const out = capture(() => {
    assert.throws(() => prettyLog.assert(false, '条件不成立'), /条件不成立/)
  })
  assert.ok(out.error.length > 0, '失败应走 console.error 通道')
})

// ---------------------------------------------------------------- R14 setStyles

test('R14: setStyles 能覆盖硬编码的圆角与内边距', () => {
  reset()
  prettyLog.setStyles({ borderRadius: '8px', padding: '4px 8px' })
  const out = capture(() => prettyLog.info('标题', '内容'))
  const style = styleOf(out.log[0], 'background')
  assert.ok(style.includes('border-radius: 8px'), `应使用自定义圆角，实际：${style}`)
  assert.ok(style.includes('padding: 4px 8px'), `应使用自定义内边距，实际：${style}`)
})

test('R14: setStyles 传 undefined 恢复默认', () => {
  reset()
  prettyLog.setStyles({ borderRadius: '8px' })
  prettyLog.setStyles({ borderRadius: undefined })
  const out = capture(() => prettyLog.info('标题', '内容'))
  assert.ok(
    styleOf(out.log[0], 'background').includes('border-radius: 2px'),
    '恢复默认圆角'
  )
})

// ---------------------------------------------------------------- R15 生产剥离

test('R15: NODE_ENV=production 时所有日志 API 静默 no-op', async () => {
  reset()
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    // 必须用 cache-busting query 强制重新求值模块：IS_PRODUCTION 在模块
    // 初始化时求值一次，若命中缓存则测的仍是开发环境的那个实例。
    const prod = await import(`../src/index.ts?prod=${Date.now()}`)
    const out = capture(() => {
      prod.info('不应出现')
      prod.error('不应出现')
      prod.debug('不应出现')
      prod.rainbow('不应出现')
      prod.group('不应出现', ['x'])
      prod.table([{ a: 1 }])
      prod.time('t')
      prod.timeEnd('t')
      prod.once('k', '不应出现')
      prod.count('c')
      prod.assert(false, '不应抛出')
    })
    const total = Object.values(out).reduce((n, arr) => n + arr.length, 0)
    assert.equal(total, 0, `生产环境应完全静默，实际输出 ${total} 条`)
    assert.equal(prod.getHistory().length, 0, '生产环境不应记录历史')
    assert.deepEqual(prod.countSummary(), {}, '生产环境不应计数')

    // 关键契约：no-op 只抑制"日志"，绝不能抑制被包裹的业务逻辑。
    // 若 timer 在生产下直接 return 而不调用 fn，用户的业务代码会被静默跳过。
    let fnRan = false
    const result = prod.timer('应仍执行', () => {
      fnRan = true
      return '业务结果'
    })
    assert.equal(fnRan, true, '生产环境下 timer 仍必须执行被包裹的函数')
    assert.equal(result, '业务结果', '生产环境下 timer 必须原样返回 fn 的结果')
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prev
  }
})