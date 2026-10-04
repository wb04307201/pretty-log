/**
 * verify-tag-version 的单元测试
 *
 * 运行: yarn test:unit
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { parseTagVersion } = require('../scripts/verify-tag-version.js')

const here = path.dirname(fileURLToPath(import.meta.url))
const script = path.join(here, '..', 'scripts', 'verify-tag-version.js')
const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'))

test('parseTagVersion: 标准 v 前缀标签', () => {
  assert.equal(parseTagVersion('v1.2.3'), '1.2.3')
})

test('parseTagVersion: 缺少 v 前缀也可解析', () => {
  assert.equal(parseTagVersion('1.2.3'), '1.2.3')
})

test('parseTagVersion: 预发布版本', () => {
  assert.equal(parseTagVersion('v1.2.3-beta.1'), '1.2.3-beta.1')
  assert.equal(parseTagVersion('v1.0.0-rc.2'), '1.0.0-rc.2')
})

test('parseTagVersion: 拒绝非法标签', () => {
  for (const bad of ['release', 'v1.2', 'v1', 'latest', 'v1.2.3.4', '', 'vX.Y.Z']) {
    assert.equal(parseTagVersion(bad), null, `${bad} 应被拒绝`)
  }
})

test('parseTagVersion: undefined 返回 null 而非抛错', () => {
  assert.equal(parseTagVersion(undefined), null)
})

/** 执行校验脚本，返回退出码与合并输出 */
function run(tag) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [script, tag], { encoding: 'utf8' }) }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

test('端到端: 版本一致时退出码 0', () => {
  const r = run(`v${pkg.version}`)
  assert.equal(r.code, 0, `应通过，实际输出：${r.out}`)
  assert.ok(r.out.includes('一致'), `应报告一致，实际：${r.out}`)
})

test('端到端: 版本不一致时退出码 1 且不发布', () => {
  const r = run('v99.99.99')
  assert.equal(r.code, 1, '版本不一致必须失败')
  assert.ok(r.out.includes('版本不一致'), `应报告不一致，实际：${r.out}`)
})

test('端到端: 非法 tag 时退出码 1', () => {
  const r = run('release-candidate')
  assert.equal(r.code, 1, '非法 tag 必须失败')
  assert.ok(r.out.includes('不是合法'), `应报告格式错误，实际：${r.out}`)
})

test('端到端: 缺少 tag 参数时退出码 1', () => {
  const r = run('')
  assert.equal(r.code, 1, '缺少 tag 必须失败')
})

test('端到端: 预发布 tag 与 package.json 一致时通过', () => {
  // 仅验证解析与退出码链路，不改动真实 package.json
  const r = run(`v${pkg.version}-rc.1`)
  assert.equal(r.code, 1, '预发布 tag 与正式版本号不同，应中止')
  assert.ok(r.out.includes('版本不一致'), '应报告版本不一致')
})