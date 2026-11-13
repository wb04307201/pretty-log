/**
 * 自绘表格（renderTable）回归测试 —— Task 2 / Task 3
 *
 * 覆盖（全部先于实现写就，RED 先行）：
 * 1. object[]：键并集列（首现顺序）、5 行 × 4 列、缺键格空文本
 * 2. 类型着色（数字/null/字符串 + 数值文本；setTheme 覆盖调用时生效）
 * 3. 数值列右对齐、混列左对齐（含表头）
 * 3b. 缺键/null 不挡右对齐（含表头），非数值对照列左对齐（M-4 补钉）
 * 4. CJK 双宽与组合字符零宽（含 emoji/ZWJ 簇行），各行总显示宽度相等
 * 5. 24 显示列截断（23 列 + …）与 history 未截断全量文本
 * 6. array[] 索引列 / 全原始值单列 (value)（含 null 元素着 null 色）
 * 7. 空数组 → 组外壳 0 行 × 0 列、无表头
 * 8. native 兜底：单对象 / Map / 混形状数组，组外壳内 console.table
 * 9. % 注入不破坏 %c 段与实参对应
 * 10. 循环引用对象不抛错，行文本含 [Circular]
 * 11. 斑马背景（第 1/3 数据行有、第 2 行没有；light 模式换浅底）
 * 12. 级别过滤零输出
 * 13. setTableMode('native') 强制 console.table、无自绘行、组外壳计数仍在
 * 14. 默认 'pretty'（object[] 不调用 console.table）
 * 15. configure({ tableMode }) 与 setTableMode 等价，setTableMode('pretty') 可切回
 * 16. withPrefix().table 标题拼接 [${prefix}] ${title}
 * 16b. withPrefix 默认表名拼接与 native 路径 history 内容（M-6 补钉）
 * 17. 生产剥离（NODE_ENV=production 时 table()/setTableMode() 零输出）
 * 18. native 敌意 getter 不抛错（逃生口不共享 pretty 单元格脆路径）
 * 19. 70000 行大表不因 spread 实参上限抛 RangeError
 * 20. dw 已知值锚点：CJK/组合符/emoji/ZWJ 簇/零宽
 *
 * 运行: node --experimental-strip-types --test test/table.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as prettyLog from '../src/index.ts'

/** 捕获一次调用期间的 console 输出（含 log/warn/error/group/groupCollapsed/groupEnd/table） */
function capture(fn: () => void): Record<string, unknown[][]> {
  const cap: Record<string, unknown[][]> = {}
  const methods = ['log', 'warn', 'error', 'group', 'groupCollapsed', 'groupEnd', 'table'] as const
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

/** 取一条 console 调用的格式串 */
function fmt(args: unknown[]): string {
  return typeof args[0] === 'string' ? (args[0] as string) : ''
}

/** 取一条 console 调用样式实参中含指定关键字者（无则空串） */
function styleOf(args: unknown[], needle: string): string {
  const hit = args.find((a): a is string => typeof a === 'string' && a.includes(needle))
  return hit ?? ''
}

/**
 * 显示宽度（测试侧独立实现，与全局约束一致：
 * 零宽（组合/变体/方向/ZWJ 等）= 0，CJK（≥ U+2E80，含代理对）= 2，其余 = 1；
 * 宽基符之间由 ZWJ 相连（链中可夹组合符/变体选择符）视为同一字素簇，整链计 2）
 *
 * 与 src/index.ts charWidth/簇规则互为镜像——改一处必须同步（刻意不 import 被测代码）。
 */
function dw(s: string): number {
  let total = 0
  let cluster = 0
  let bases = 0
  let chain = false
  let lastWide = false
  let sawZwj = false
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    const zw =
      (cp >= 0x0300 && cp <= 0x036f) ||
      (cp >= 0x0591 && cp <= 0x05c7) ||
      (cp >= 0x0610 && cp <= 0x061a) ||
      (cp >= 0x064b && cp <= 0x065f) ||
      cp === 0x0670 ||
      (cp >= 0x06d6 && cp <= 0x06ed) ||
      (cp >= 0x1ab0 && cp <= 0x1aff) ||
      (cp >= 0x1dc0 && cp <= 0x1dff) ||
      (cp >= 0x200b && cp <= 0x200f) ||
      (cp >= 0x20d0 && cp <= 0x20ff) ||
      (cp >= 0xfe00 && cp <= 0xfe0f) ||
      (cp >= 0xfe20 && cp <= 0xfe2f) ||
      cp === 0xfeff
    if (zw) {
      if (cp === 0x200d) sawZwj = true // ZWJ 连链
      continue // 零宽码点计 0
    }
    const wide = cp >= 0x2e80
    const w = wide ? 2 : 1
    if (bases > 0 && wide && lastWide && sawZwj) {
      cluster += w // 宽-ZWJ-宽：同簇（flush 时整链计 2）
      bases += 1
      chain = true
    } else {
      total += chain ? 2 : cluster
      cluster = w
      bases = 1
      chain = false
    }
    lastWide = wide
    sawZwj = false
  }
  total += chain ? 2 : cluster
  return total
}

/** 把一行格式串拆为各单元格文本（去 %c 前缀与格间 2 空格 gutter；用于不含 % 的行） */
function cellsOf(args: unknown[]): string[] {
  const parts = fmt(args)
    .split(/(?<!%)%c/)
    .slice(1)
  return parts.map((seg, i) => (i < parts.length - 1 ? seg.slice(0, -2) : seg))
}

/** 复位全局配置，避免用例互相污染 */
function reset(): void {
  prettyLog.configure({
    logLevel: 'debug',
    showEmoji: false,
    showTimestamp: false,
    historySize: 200,
    tableMode: 'pretty',
  })
  prettyLog.resetTheme()
  prettyLog.clearHistory()
}

// ---------------------------------------------------------------- 1 键并集列

test('table 1: object[] 键并集列（首现顺序）、5 行 × 4 列、缺键格空文本', () => {
  reset()
  const rows = [
    { id: 1, name: 'Alice', role: 'dev' },
    { name: 'Bob', score: 80 },
    { id: 3, role: 'ops', score: 70 },
    { score: 60, id: 4, name: 'Carol' },
    { role: 'dev', score: 50, name: 'Dave' },
  ]
  const out = capture(() => prettyLog.table(rows, '成绩单'))

  assert.ok(fmt(out.group[0]).includes('5 行 × 4 列'), `组标签应含计数，实际：${fmt(out.group[0])}`)
  assert.ok(fmt(out.group[0]).includes('成绩单'), `组标签应含表名，实际：${fmt(out.group[0])}`)
  assert.equal(out.log.length, 6, '表头 1 行 + 数据 5 行')
  assert.deepEqual(
    cellsOf(out.log[0]).map((c) => c.trim()),
    ['id', 'name', 'role', 'score'],
    '表头应为键并集、按首现顺序'
  )
  assert.equal(out.table.length, 0, 'pretty 形状不应调用 console.table')
  assert.equal(out.groupEnd.length, 1, '组外壳应闭合')

  // 第 2 个数据行缺 id/role：空文本、无类型色（该行无斑马，样式应为空串）
  const row2 = out.log[2]
  assert.equal(row2[1], '', '缺键格（id）应无类型色')
  assert.equal(row2[3], '', '缺键格（role）应无类型色')
  assert.equal(cellsOf(row2)[0].trim(), '', '缺键格文本应为空')
  assert.ok(styleOf(row2, '#e8eaed').length > 0, '在场字符串格应有 body 色')
})

// ---------------------------------------------------------------- 2 类型着色

test('table 2: 类型着色——数字/null/字符串与数值文本，主题覆盖调用时生效', () => {
  reset()
  const data = [{ n: 42, z: null, s: 'hi', d: '92.5' }]
  const out = capture(() => prettyLog.table(data))
  const row = out.log[1]
  assert.ok(String(row[1]).includes('#fde68a'), `数字格应为 texts.warning，实际：${row[1]}`)
  assert.ok(String(row[2]).includes('#8b93a7'), `null 格应为 texts.null，实际：${row[2]}`)
  assert.ok(String(row[3]).includes('#e8eaed'), `字符串格应为 texts.body，实际：${row[3]}`)
  assert.ok(String(row[4]).includes('#fde68a'), `数值文本格（'92.5'）应为 texts.warning，实际：${row[4]}`)

  prettyLog.setTheme({ texts: { warning: '#00FF00' } })
  const out2 = capture(() => prettyLog.table(data))
  assert.ok(String(out2.log[1][1]).includes('#00FF00'), `setTheme 后数字格应取新色，实际：${out2.log[1][1]}`)
  assert.ok(String(out2.log[1][4]).includes('#00FF00'), `setTheme 后数值文本格应取新色，实际：${out2.log[1][4]}`)
})

// ---------------------------------------------------------------- 3 列对齐

test('table 3: 数值列右对齐、混列左对齐（含表头）', () => {
  reset()
  const data = [
    { r: 'dev', x: 9 },
    { r: 'ops', x: 1000 },
    { r: 'longv', x: 42 },
  ]
  const out = capture(() => prettyLog.table(data))
  const lead = (s: string): number => (s.match(/^ +/) ?? [''])[0].length
  const trail = (s: string): number => (s.match(/ +$/) ?? [''])[0].length

  const h = cellsOf(out.log[0])
  assert.ok(lead(h[1]) > trail(h[1]), `数值列表头应右对齐，实际：${JSON.stringify(h[1])}`)
  assert.ok(trail(h[0]) > lead(h[0]), `混列表头应左对齐，实际：${JSON.stringify(h[0])}`)

  const r1 = cellsOf(out.log[1])
  assert.ok(lead(r1[1]) > trail(r1[1]), `数值列单元格应右对齐，实际：${JSON.stringify(r1[1])}`)
  assert.ok(trail(r1[0]) > lead(r1[0]), `混列单元格应左对齐，实际：${JSON.stringify(r1[0])}`)
})

// ---------------------------------------------------------------- 3b 缺键/null 不挡右对齐（M-4 补钉）

test('table 3b: 缺键/null 不挡右对齐（含表头），非数值对照列左对齐', () => {
  reset()
  // s 列有 null 与缺键格、但全部非空值为数值 → 右对齐；n 列含非数值非空值 → 左对齐
  const data = [
    { s: 9, n: 'ok' },
    { s: null, n: 'long-note' },
    { n: 'x' }, // s 缺键
    { s: 1000 }, // n 缺键
  ]
  const out = capture(() => prettyLog.table(data))
  const lead = (s: string): number => (s.match(/^ +/) ?? [''])[0].length
  const trail = (s: string): number => (s.match(/ +$/) ?? [''])[0].length

  const h = cellsOf(out.log[0])
  assert.ok(lead(h[0]) > trail(h[0]), `数值列表头应右对齐（null/缺键不挡），实际：${JSON.stringify(h[0])}`)
  assert.ok(trail(h[1]) > lead(h[1]), `非数值对照列表头应左对齐，实际：${JSON.stringify(h[1])}`)

  const r1 = cellsOf(out.log[1])
  assert.ok(lead(r1[0]) > trail(r1[0]), `数值列单元格应右对齐，实际：${JSON.stringify(r1[0])}`)
  assert.ok(trail(r1[1]) > lead(r1[1]), `非数值对照列单元格应左对齐，实际：${JSON.stringify(r1[1])}`)
})

// ---------------------------------------------------------------- 4 CJK 等宽

test('table 4: CJK 双宽与组合字符零宽，各行总显示宽度相等', () => {
  reset()
  const data = [
    { name: '张三', role: 'dev' },
    { name: 'Alice', role: 'ops' },
    // e + 组合尖音符（U+0301）+ clair：显示宽度 6，组合符计 0
    { name: 'e\u0301clair', role: 'x' },
    // 🎉（U+1F389）：单个宽基符，显示宽度 2
    { name: '🎉', role: 'dev' },
    // 👨‍👩‍👧（U+1F468 ZWJ U+1F469 ZWJ U+1F467）：三宽基符 ZWJ 链，整链计 2
    { name: '👨‍👩‍👧', role: 'ops' },
  ]
  const out = capture(() => prettyLog.table(data))
  const widths = out.log.map((args) => dw(fmt(args).replace(/(?<!%)%c/g, '')))
  // name 列宽 6、role 列宽 4 → 行显示宽 = (1+6+1) + 2 + (1+4+1) = 16（emoji 簇行同宽对齐）
  assert.deepEqual(widths, [16, 16, 16, 16, 16, 16], `表头与各行显示宽度应相等且为 16，实际：${widths}`)
})

// ---------------------------------------------------------------- 5 截断

test('table 5: 单元格 24 显示列截断为 23 列 + …，history 存未截断全量', () => {
  reset()
  const long = 'x'.repeat(30)
  const out = capture(() => prettyLog.table([{ msg: long }], '截断表'))
  const row = fmt(out.log[1])
  assert.ok(row.includes('x'.repeat(23) + '…'), `单元格应截为 23 列 + …，实际：${row}`)
  assert.ok(!row.includes(long), '行内不应出现完整 30 列原串')

  const entry = prettyLog.getHistory().slice(-1)[0]
  assert.equal(entry.title, '截断表', '历史 title 应为表名')
  assert.ok(String(entry.content[0]).includes(long), 'history 应含未截断完整原串')
})

// ---------------------------------------------------------------- 6 索引列 / 单列

test('table 6: array[] 索引列；全原始值单列 (value) 且 null 元素着 null 色', () => {
  reset()
  const out1 = capture(() => prettyLog.table([[10, 20], [30]]))
  assert.deepEqual(
    cellsOf(out1.log[0]).map((c) => c.trim()),
    ['0', '1'],
    '索引列应为 0..maxLen-1'
  )
  assert.ok(fmt(out1.group[0]).includes('2 行 × 2 列'), `实际：${fmt(out1.group[0])}`)

  const out2 = capture(() => prettyLog.table(['a', 42, null]))
  assert.deepEqual(
    cellsOf(out2.log[0]).map((c) => c.trim()),
    ['(value)'],
    '全原始值应为单列 (value)'
  )
  assert.ok(fmt(out2.group[0]).includes('3 行 × 1 列'), `实际：${fmt(out2.group[0])}`)
  assert.ok(String(out2.log[3][1]).includes('#8b93a7'), `null 元素格应着 texts.null，实际：${out2.log[3][1]}`)
})

// ---------------------------------------------------------------- 7 空数组

test('table 7: 空数组只输出组外壳 0 行 × 0 列，无表头', () => {
  reset()
  const out = capture(() => prettyLog.table([], '空表'))
  assert.ok(fmt(out.group[0]).includes('0 行 × 0 列'), `实际：${fmt(out.group[0])}`)
  assert.ok(fmt(out.group[0]).includes('空表'), `组标签应含表名，实际：${fmt(out.group[0])}`)
  assert.equal(out.log.length, 0, '不应有表头/数据行')
  assert.equal(out.groupEnd.length, 1, '组外壳应闭合')
})

// ---------------------------------------------------------------- 8 native 兜底

test('table 8: native 兜底——单对象 / Map / 混形状数组，组外壳内 console.table', () => {
  reset()
  const obj = { a: 1 }
  const o = capture(() => prettyLog.table(obj, 'T1'))
  assert.equal(o.table.length, 1, '应调用 console.table')
  assert.equal(o.table[0][0], obj, 'console.table 应收到原始数据')
  assert.equal(o.group.length, 1, '应有组外壳')
  assert.equal(o.groupEnd.length, 1, '组外壳应闭合')
  assert.equal(o.log.length, 0, 'native 不应自绘行')
  assert.equal(o.group[0].length, 2, '非数组输入省略计数段')

  const map = new Map([['k', 'v']])
  const m = capture(() => prettyLog.table(map, 'T2'))
  assert.equal(m.table.length, 1, 'Map 应调用 console.table')
  assert.equal(m.table[0][0], map, 'console.table 应收到原始 Map')
  assert.equal(m.group.length, 1, '应有组外壳')
  assert.equal(m.group[0].length, 2, '非数组输入省略计数段')

  const x = capture(() => prettyLog.table([{}, [1]], 'T3'))
  assert.equal(x.table.length, 1, '混形状数组应调用 console.table')
  assert.equal(x.group.length, 1, '应有组外壳')
  assert.equal(x.groupEnd.length, 1, '组外壳应闭合')
  assert.equal(x.log.length, 0, 'native 不应自绘行')
  assert.equal(x.group[0].length, 3, '数组输入保留计数段')
  assert.ok(fmt(x.group[0]).includes('2 行'), `计数段应含行数，实际：${fmt(x.group[0])}`)
})

// ---------------------------------------------------------------- 9 % 注入

test('table 9: 单元格含 %c/%s 时转义，不破坏 %c 段与实参对应', () => {
  reset()
  const out = capture(() =>
    prettyLog.table([
      { a: '%c INJECT', b: '%s INJECT' },
      { a: 'x', b: 'y' },
    ])
  )
  // 非空前置：堵住输出消失时循环空转恒真
  assert.ok(out.log.length > 0, '应有自绘行输出')
  for (const args of out.log) {
    // 先剥掉转义对 %%，剩下的 %c / %s 才是真实格式符
    const bare = fmt(args).replace(/%%/g, '')
    const segs = (bare.match(/%c/g) ?? []).length
    assert.equal(args.length - 1, segs, `样式实参数应等于 %c 段数，实际 fmt：${fmt(args)}`)
    assert.equal((bare.match(/%s/g) ?? []).length, 0, `转义后不应残留裸 %s，实际 fmt：${fmt(args)}`)
  }
})

// ---------------------------------------------------------------- 10 循环引用

test('table 10: 循环引用对象不抛错，行文本含 [Circular]', () => {
  reset()
  const b: Record<string, unknown> = {}
  b.b = b
  const out = capture(() => prettyLog.table([b], '循环'))
  assert.ok(fmt(out.log[1]).includes('[Circular]'), `行文本应含 [Circular]，实际：${fmt(out.log[1])}`)
})

// ---------------------------------------------------------------- 11 斑马

test('table 11: 斑马——第 1/3 数据行有底色、第 2 行没有；light 模式换浅底', () => {
  reset()
  const data = [{ v: 'a' }, { v: 'b' }, { v: 'c' }]
  const out = capture(() => prettyLog.table(data))
  assert.ok(styleOf(out.log[1], 'rgba(255,255,255,0.055)').length > 0, '第 1 个数据行应有 dark 斑马底')
  assert.equal(styleOf(out.log[2], 'rgba(255,255,255,0.055)'), '', '第 2 个数据行不应有斑马底')
  assert.ok(styleOf(out.log[3], 'rgba(255,255,255,0.055)').length > 0, '第 3 个数据行应有 dark 斑马底')

  prettyLog.setTheme({ mode: 'light' })
  const out2 = capture(() => prettyLog.table(data))
  assert.ok(styleOf(out2.log[1], 'rgba(0,0,0,0.05)').length > 0, 'light 模式应换浅底斑马')
  assert.equal(styleOf(out2.log[2], 'rgba(0,0,0,0.05)'), '', 'light 模式第 2 行仍不应有斑马底')
})

// ---------------------------------------------------------------- 12 级别过滤

test('table 12: setLogLevel("error") 后 table 零输出', () => {
  reset()
  prettyLog.setLogLevel('error')
  const out = capture(() => prettyLog.table([{ a: 1 }], '级别'))
  const total = Object.values(out).reduce((n, arr) => n + arr.length, 0)
  assert.equal(total, 0, `级别过滤后应零输出，实际 ${total} 条`)
  assert.equal(prettyLog.getHistory().length, 0, '被过滤的 table 不应写历史')
})

// ---------------------------------------------------------------- 13 setTableMode 降级

test('table 13: setTableMode("native") 强制 console.table、无自绘行、组外壳计数仍在', () => {
  reset()
  prettyLog.setTableMode('native')
  const data = [{ a: 1 }, { a: 2 }]
  const out = capture(() => prettyLog.table(data, '降级'))
  assert.equal(out.table.length, 1, 'native 模式应调用 console.table')
  assert.equal(out.table[0][0], data, 'console.table 应收到原始数据')
  assert.equal(out.log.length, 0, 'native 模式不应自绘数据行')
  assert.equal(out.group.length, 1, '应有组外壳')
  assert.equal(out.groupEnd.length, 1, '组外壳应闭合')
  assert.ok(fmt(out.group[0]).includes('2 行 × 1 列'), `数组输入计数段应保留，实际：${fmt(out.group[0])}`)
})

// ---------------------------------------------------------------- 14 默认 pretty

test('table 14: 默认 "pretty"——object[] 自绘，不调用 console.table', () => {
  reset()
  const out = capture(() => prettyLog.table([{ a: 1 }], '默认'))
  assert.equal(out.table.length, 0, '默认 pretty 不应调用 console.table')
  assert.ok(out.log.length > 0, '默认 pretty 应自绘行')
})

// ---------------------------------------------------------------- 15 configure 等价

test('table 15: configure({ tableMode: "native" }) 与 setTableMode 等价，setTableMode("pretty") 可切回', () => {
  reset()
  prettyLog.configure({ tableMode: 'native' })
  const out1 = capture(() => prettyLog.table([{ a: 1 }], 'A'))
  assert.equal(out1.table.length, 1, 'configure("native") 应走 console.table')
  assert.equal(out1.log.length, 0, 'configure("native") 不应自绘')

  prettyLog.setTableMode('pretty')
  const out2 = capture(() => prettyLog.table([{ a: 1 }], 'B'))
  assert.equal(out2.table.length, 0, '切回 pretty 不应调用 console.table')
  assert.ok(out2.log.length > 0, '切回 pretty 应自绘行')

  prettyLog.setTableMode('native')
  const out3 = capture(() => prettyLog.table([{ a: 1 }], 'C'))
  assert.equal(out3.table.length, 1, 'setTableMode("native") 应走 console.table')
  assert.equal(out3.log.length, 0, 'setTableMode("native") 不应自绘')
})

// ---------------------------------------------------------------- 16 withPrefix.table

test('table 16: withPrefix("X").table(data, "T") 组标签含 [X] T', () => {
  reset()
  const out = capture(() => prettyLog.withPrefix('X').table([{ a: 1 }], 'T'))
  assert.ok(fmt(out.group[0]).includes('[X] T'), `组标签应含 [X] T，实际：${fmt(out.group[0])}`)

  // 默认表名也走拼接：[X] Table（M-6 补钉）
  const out2 = capture(() => prettyLog.withPrefix('X').table([{ a: 1 }]))
  assert.ok(fmt(out2.group[0]).includes('[X] Table'), `默认表名应拼为 [X] Table，实际：${fmt(out2.group[0])}`)
})

test('table 16b: native 路径 history 写 stringify(data) 全文（title=表名）', () => {
  reset()
  prettyLog.setTableMode('native')
  capture(() => prettyLog.table([{ alpha: 'one', beta: 2 }], '原生表'))
  const entry = prettyLog.getHistory().slice(-1)[0]
  assert.equal(entry.title, '原生表', '历史 title 应为表名')
  const content = String(entry.content[0])
  assert.ok(content.length > 0, 'content[0] 应非空')
  assert.ok(
    content.includes('alpha') && content.includes('one') && content.includes('beta') && content.includes('2'),
    `content[0] 应为 stringify(data) 全文（含键与值文本），实际：${content}`
  )
})

// ---------------------------------------------------------------- 17 生产剥离

test('table 17: 生产剥离——NODE_ENV=production 时 table()/setTableMode() 零输出', async () => {
  reset()
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    // 沿用 features.test.ts R15 手法：cache-busting 查询强制重新求值模块
    // （IS_PRODUCTION 在模块初始化时定值，命中缓存则测的仍是开发环境实例）
    const prod = await import(`../src/index.ts?prod=${Date.now()}`)
    const out = capture(() => {
      prod.setTableMode('native')
      prod.table([{ a: 1 }], '不应出现')
    })
    const total = Object.values(out).reduce((n, arr) => n + arr.length, 0)
    assert.equal(total, 0, `生产环境应完全静默，实际输出 ${total} 条`)
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prev
  }
})

// ---------------------------------------------------------------- 18 native 敌意 getter

test('table 18: setTableMode("native") 敌意 getter 不抛错，组外壳与 console.table 正常', () => {
  reset()
  prettyLog.setTableMode('native')
  // stringify 的契约是「不抛错」而非「零求值」——JSON.stringify 遍历属性会触发
  // getter 副作用（catch 只兜住抛错），故只钉不抛，不对是否触碰 getter 作断言。
  const rows = [
    {
      id: 1,
      get boom(): string {
        throw new Error('GETTER')
      },
    },
  ]
  let out: Record<string, unknown[][]> = {}
  assert.doesNotThrow(() => {
    out = capture(() => prettyLog.table(rows, 'T'))
  }, 'native 降级不应向调用方抛错')
  assert.equal(out.table.length, 1, 'console.table 应被调用一次')
  assert.equal(out.group.length, 1, '组外壳应开启')
})

// ---------------------------------------------------------------- 19 大表去 spread

test('table 19: 70000 行大表列宽计算不因 spread 实参上限抛 RangeError', () => {
  reset()
  // 超过 V8 实参上限 65535：旧实现 Math.max(...cells.map(...)) 展开传参会抛 RangeError
  const bigRows = Array.from({ length: 70000 }, (_, i) => i)
  let out: Record<string, unknown[][]> = {}
  assert.doesNotThrow(() => {
    out = capture(() => prettyLog.table(bigRows, '大表'))
  }, '列宽计算不应因 spread 实参上限抛 RangeError')
  assert.ok(fmt(out.group[0]).includes('70000 行 × 1 列'), `组外壳计数段应正常，实际：${fmt(out.group[0])}`)
  assert.equal(out.groupEnd.length, 1, '组外壳应闭合')
})

// ---------------------------------------------------------------- 20 dw 已知值锚点

test('table 20: dw 已知值锚点——CJK/组合符/emoji/ZWJ 簇/零宽', () => {
  // 防自证锚点：与 src 侧实现互查，值必须命中真值而非两边一起错
  assert.equal(dw('张三'), 4, 'CJK 双宽 ×2 = 4')
  assert.equal(dw('Alice'), 5, 'ASCII 逐码点 1 = 5')
  assert.equal(dw('é'), 1, 'e + U+0301：组合吸收计 0')
  assert.equal(dw('🎉'), 2, '🎉 单宽基符 = 2')
  assert.equal(dw('👨‍👩‍👧'), 2, '👨‍👩‍👧 ZWJ 链整链计 2')
  assert.equal(dw('🧑‍💻'), 2, '🧑‍💻 ZWJ 链整链计 2')
  assert.equal(dw('a​b'), 2, 'a + ZWSP(U+200B) + b：零宽计 0')
})
