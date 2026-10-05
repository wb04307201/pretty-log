/**
 * release.yml 的认证接线契约测试
 *
 * 为什么需要它：本仓没有 actionlint 之类的 workflow 静态校验，
 * 而「npm 认证接线是否正确」这件事要等真发版才显形。
 * 一旦有人改错发布链路，唯一的信号是发版时那句 ENEEDAUTH ���—
 * 代价是一次失败的发布。这里把它降级为一次失败的测试。
 *
 * 断言刻意只针对键名与结构，不依赖 step 的绝对行号，
 * 避免重排 steps 时产生假失败。
 *
 * 运行: yarn test:unit（CI 走 test:unit:offline）
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const workflow = fs.readFileSync(path.join(here, '..', '.github', 'workflows', 'release.yml'), 'utf8')

/** 取出「发布到 npm」这个 step 的文本块 */
function publishStep() {
  const start = workflow.indexOf('- name: 发布到 npm')
  assert.notEqual(start, -1, '应存在「发布到 npm」步骤')
  return workflow.slice(start)
}

/** 取出「诊断认证状态」这个 step 的文本块 */
function diagnosticStep() {
  const start = workflow.indexOf('- name: 诊断认证状态')
  const end = workflow.indexOf('- name: 发布到 npm')
  assert.notEqual(start, -1, '应存在「诊断认证状态」步骤')
  assert.ok(end > start, '诊断步骤应在发布步骤之前')
  return workflow.slice(start, end)
}

/** step 的 env: 块里注入的变量名 */
function injectedEnvVars(stepText) {
  return [...stepText.matchAll(/^\s{10}([A-Z_]+):\s*\$\{\{/gm)].map((m) => m[1])
}

test('setup-node 不得配置 registry-url', () => {
  // registry-url 会让 setup-node 生成含 ${NODE_AUTH_TOKEN} 的 .npmrc 并
  // 把 NPM_CONFIG_USERCONFIG 全局导出。本工作流先跑 `yarn install`，
  // yarn 1 读到无法替换的 ${...} 会抛 `Failed to replace env in config`
  // 直接中止 —— 认证没修好，倒先把依赖安装步骤搞崩了。
  assert.doesNotMatch(
    workflow,
    /registry-url:/,
    'setup-node 不应配 registry-url：它生成的 .npmrc 会让前面的 yarn install 抛 Failed to replace env'
  )
})

test('发布步骤必须自建 .npmrc 并经 NPM_CONFIG_USERCONFIG 传给 npm', () => {
  const step = publishStep()
  assert.match(
    step,
    /_authToken=\$\{NODE_AUTH_TOKEN\}/,
    '发布步骤应写入含 _authToken=${NODE_AUTH_TOKEN} 的 .npmrc'
  )
  assert.match(
    step,
    /NPM_CONFIG_USERCONFIG=\S+\s*\\?\s*\n?\s*npm publish/,
    'npm publish 必须通过 NPM_CONFIG_USERCONFIG 指向那份 .npmrc，否则 npm 读不到凭据'
  )
})

test('发布步骤的凭据变量必须是 NODE_AUTH_TOKEN', () => {
  // 必须与 .npmrc 里写的 ${NODE_AUTH_TOKEN} 一致，否则插值落空 → ENEEDAUTH
  assert.match(
    publishStep(),
    /NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets\.NPM_TOKEN\s*\}\}/,
    '发布步骤的 env 应为 NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}（Secret 名不变，仅工作流内变量名不同）'
  )
})

test('诊断步骤与发布步骤用同一个凭据变量名', () => {
  // 两处不一致会导致诊断「看起来正常」而发布失败
  const diagVars = injectedEnvVars(diagnosticStep())
  const publishVars = injectedEnvVars(publishStep())

  assert.ok(diagVars.length > 0, '诊断步骤应至少注入一个凭据变量')
  assert.deepEqual(
    [...diagVars].sort(),
    [...publishVars].sort(),
    '诊断步骤与发布步骤的凭据变量名不一致，会诊断出「凭据已配置」而实际发布失败'
  )
})

test('诊断步骤同样要经 NPM_CONFIG_USERCONFIG 使用那份 .npmrc', () => {
  // 否则 whoami 探测的是无凭据状态，会给出与发布步骤不一致的结论
  assert.match(
    diagnosticStep(),
    /NPM_CONFIG_USERCONFIG=/,
    '诊断步骤应通过 NPM_CONFIG_USERCONFIG 指向 .npmrc，否则探测结果与发布步骤不一致'
  )
})

test('凭据不得跨步骤泄漏：写 .npmrc 只发生在需要它的步骤内', () => {
  // NPM_CONFIG_USERCONFIG 若由 setup-node 导出就会全 job 生效；
  // 本实现只在单条命令前临时指定，故不得出现 export/exportVariable 形式。
  assert.doesNotMatch(
    workflow,
    /export\s+NPM_CONFIG_USERCONFIG/,
    '不得用 export 导出 NPM_CONFIG_USERCONFIG（会全 job 生效并波及 yarn install）'
  )
  assert.doesNotMatch(
    workflow,
    /echo\s+["']?NPM_CONFIG_USERCONFIG=/,
    '不得用 $GITHUB_ENV 持久化 NPM_CONFIG_USERCONFIG'
  )
})

test('仓库内不得出现令牌明文', () => {
  // 凭据只能来自 secrets。防止有人为了「省事」把 token 硬写进 workflow。
  assert.doesNotMatch(
    workflow,
    /_authToken\s*=\s*(?!\$\{)[^\s'"]+/,
    'release.yml 中不得出现 _authToken 明文赋值'
  )
  assert.doesNotMatch(workflow, /npm_[A-Za-z0-9]{20,}/, 'release.yml 中不得出现疑似 npm 令牌明文')
})