/**
 * release.yml 的认证接线契约测试（Trusted Publishing / OIDC）
 *
 * 为什么需要它：本仓没有 actionlint 之类的 workflow 静态校验，
 * 而「npm 认证接线是否正确」要等真发版才显形。OIDC 的失败尤其隐蔽 ——
 * npm 在拿不到 id_token 时不报错，而是静默降级为无凭据，
 * 最终以 ENEEDAUTH 收场，看起来像认证坏了而不是权限漏了。
 * 这里把它降级为一次失败的测试。
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

/** 取出「发布到 npm」这个 step 的文本块（已剥离注释行） */
function publishStep() {
  const start = effectiveConfig().indexOf('- name: 发布到 npm')
  assert.notEqual(start, -1, '应存在「发布到 npm」步骤')
  return effectiveConfig().slice(start)
}

/** 取出「诊断认证状态」这个 step 的文本块（已剥离注释行） */
function diagnosticStep() {
  const config = effectiveConfig()
  const start = config.indexOf('- name: 诊断认证状态')
  const end = config.indexOf('- name: 发布到 npm')
  assert.notEqual(start, -1, '应存在「诊断认证状态」步骤')
  assert.ok(end > start, '诊断步骤应在发布步骤之前')
  return config.slice(start, end)
}

/**
 * 去掉 YAML 注释行，只留实际生效的配置。
 * 断言针对的是「工作流做了什么」，而非「注释怎么描述它」——
 * 否则解释性的注释里提到 _authToken 就会造成假失败。
 */
function effectiveConfig() {
  return workflow
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
}

test('必须授予 id-token: write 权限', () => {
  // OIDC 的命门。缺这一行时 npm CLI 打印 "Skipped because incorrect
  // permissions for id-token within GitHub workflow" 后静默退回 ENEEDAUTH
  assert.match(
    workflow,
    /^\s{2}id-token:\s*write\s*$/m,
    'workflow 必须声明 id-token: write，否则 OIDC 会被静默跳过'
  )
})

test('不得再注入 NPM_TOKEN secret', () => {
  // Trusted Publishing 的全部意义就是不用长期 token。留着既无用又是隐患。
  assert.doesNotMatch(
    workflow,
    /secrets\.NPM_TOKEN/,
    'OIDC 模式不应引用 secrets.NPM_TOKEN：改用 Trusted Publishing 后仓库不应持有长期令牌'
  )
})

test('不得配置 registry-url', () => {
  // 它会生成含 ${NODE_AUTH_TOKEN} 的 .npmrc 并把 NPM_CONFIG_USERCONFIG
  // 导出为 job 全局，击穿先执行的 yarn install（yarn 1 抛
  // Failed to replace env in config 直接中止）。OIDC 不需要 .npmrc。
  assert.doesNotMatch(
    workflow,
    /registry-url:/,
    'setup-node 不应配 registry-url：它生成的 .npmrc 会让前面的 yarn install 抛 Failed to replace env'
  )
})

test('不得残留 .npmrc / _authToken 接线', () => {
  // OIDC 下凭据由 id_token 交换而来；手工 .npmrc 是上一版 token 方案的遗留
  assert.doesNotMatch(effectiveConfig(), /_authToken=/, 'OIDC 模式不应手工写 _authToken')
  assert.doesNotMatch(
    effectiveConfig(),
    /NPM_CONFIG_USERCONFIG\s*=/,
    'OIDC 模式不应使用 NPM_CONFIG_USERCONFIG 指向手工 .npmrc'
  )
})

test('必须确保 npm CLI 版本足够新', () => {
  // Trusted Publishing 需 npm >= 11.5.1；更早版本没有 oidc 交换逻辑。
  // Node 24 捆绑的 npm 版本会漂移，故必须显式升级而非依赖默认。
  assert.match(
    workflow,
    /npm install -g npm@latest/,
    '应显式升级 npm CLI：OIDC 需要 >= 11.5.1，不能依赖 Node 捆绑版本'
  )
})

test('诊断步骤应检查 OIDC 的两个失效前提', () => {
  // npm 在 OIDC 失败时静默降级，不报错，故必须显式探测
  const step = diagnosticStep()
  assert.match(step, /ACTIONS_ID_TOKEN_REQUEST_URL/, '诊断步骤应检查 id-token 端点是否已注入')
  assert.match(step, /npm --version|npm -v/, '诊断步骤应回显 npm 版本（OIDC 需 >= 11.5.1）')
  assert.match(step, /npm whoami/, '诊断步骤应跑 whoami 探测：它会走同一条 OIDC 交换路径')
})

test('发布步骤不应再设置凭据相关环境变量', () => {
  assert.doesNotMatch(
    publishStep(),
    /NPM_CONFIG_USERCONFIG|NODE_AUTH_TOKEN|_authToken/,
    '发布步骤不应出现凭据配置：OIDC 全程由 npm CLI 自动完成'
  )
  assert.match(publishStep(), /npm publish/, '发布步骤应直接调用 npm publish')
})

/**
 * 每个 step 只能有一个 run 键。
 *
 * 这不是洁癖：写两个 run 会让 GitHub 拒绝加载整个 workflow
 * （Invalid workflow file ... 'run' is already defined），
 * 所有 job 都不会执行 —— 而本地用 yaml.safe_load 解析时它会
 * 静默取最后一个，不报任何错。本地全绿、真机全红的典型案例。
 */
test('每个 step 不得有重复的 run 键', () => {
  // 逐行扫描 step 体（从 "- name:" 或 "- uses:" 开始，到下一个 step 前）
  const lines = workflow.split('\n')
  const stepStarts = []
  lines.forEach((line, i) => {
    if (/^\s{6}-\s+(name|uses):/.test(line)) stepStarts.push(i)
  })
  assert.ok(stepStarts.length > 0, '应能识别出 step')

  for (let n = 0; n < stepStarts.length; n++) {
    const from = stepStarts[n]
    const to = n + 1 < stepStarts.length ? stepStarts[n + 1] : lines.length
    const nameLine = lines[from].trim()
    const runLines = lines
      .slice(from, to)
      .filter((l) => /^\s{8}run:/.test(l))
    assert.ok(
      runLines.length <= 1,
      `step「${nameLine}」有 ${runLines.length} 个 run 键（${runLines.length > 1 ? 'GitHub 会拒绝加载整个 workflow' : ''}）。` +
        '合并成一个 run: | 块。'
    )
  }
})

test('仓库内不得出现令牌明文', () => {
  assert.doesNotMatch(
    workflow,
    /_authToken\s*=\s*(?!\$\{)[^\s'"]+/,
    'release.yml 中不得出现 _authToken 明文赋值'
  )
  assert.doesNotMatch(workflow, /npm_[A-Za-z0-9]{20,}/, 'release.yml 中不得出现疑似 npm 令牌明文')
})