/**
 * check-version-published（发布幂等保护）的测试
 *
 * 该脚本会真实访问 npm registry，故仅测试契约性的分支：
 * 参数校验、以及对已发布/未发布两种状态的退出码区分。
 *
 * 运行: yarn test:unit
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const script = path.join(here, '..', 'scripts', 'check-version-published.js')

/** 执行脚本，返回 { code, out }；code 为退出码 */
function run(version) {
  const args = version === undefined ? [script] : [script, version]
  try {
    return { code: 0, out: execFileSync(process.execPath, args, { encoding: 'utf8' }) }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

test('缺少版本参数时中止（exit 2）', () => {
  const r = run(undefined)
  assert.equal(r.code, 2, '缺参数必须中止而非误判为"未发布"')
  assert.ok(r.out.includes('缺少版本参数'), `应报告缺参数，实际：${r.out}`)
})

test('已发布的版本应跳过（exit 0）', { timeout: 60000 }, () => {
  // 刻意用硬编码的 1.0.0 而非 pkg.version —— pkg.version 是待发布的版本，
  // 在真正 publish 之前它当然"未发布"，用当前版本会让本用例在发版前后
  // 表现相反，失去回归价值。1.0.0 已确定发布过。
  const r = run('1.0.0')
  assert.equal(r.code, 0, `已发布版本应返回 0 以跳过，实际输出：${r.out}`)
  assert.ok(r.out.includes('已发布'), `应报告已发布，实际：${r.out}`)
})

test('未发布的版本应放行（exit 1）', { timeout: 60000 }, () => {
  const r = run('99.99.99')
  assert.equal(r.code, 1, `未发布版本应返回 1 以继续，实际输出：${r.out}`)
  assert.ok(r.out.includes('尚未发布'), `应报告未发布，实际：${r.out}`)
})

test('脚本读取的包名与 package.json 一致', () => {
  const src = require('node:fs').readFileSync(script, 'utf8')
  assert.ok(
    src.includes("require(path.join(__dirname, '..', 'package.json')).name"),
    '包名应从 package.json 读取，不硬编码'
  )
})
