# 发布流程

本项目采用 **GitHub Release 驱动的自动发布**：

在 Gitee 打一个形如 `v1.2.3` 的 tag → Gitee 镜像把它同步到 GitHub →
你在 GitHub 上为该 tag 创建一个 Release → Actions 自动完成校验、测试、
构建、发布到 npm。

---

## 一次性准备：登记 Trusted Publisher

本仓库用**Trusted Publishing（OIDC）**发布到 npm，**不需要任何 Secret**。

npm 通过 OIDC 与你的 GitHub 仓库建立信任关系：CI 运行时用短期的
`id_token` 换取发布令牌，令牌用完即失效，仓库里也不存在长期凭据。

### 在 npm 后台登记

npmjs.com → 你的包 `@wb04307201/pretty-log` → **Access** 标签页 →
**Set up Trusted Publisher**：

| 项 | 填什么 |
|---|---|
| Publisher | `GitHub Actions` |
| Organization or user | `wb04307201` |
| Repository | `pretty-log` |
| Workflow filename | `release.yml` |
| Label | 随意，如 `GitHub Actions release` |
| Allowed actions | 勾选 **`Allow npm publish`** |

> ⚠️ **这些字段创建后不可修改**（npm 页面原文：*Cannot be changed later.*）。
> 填错只能删除连接后重建。`Workflow filename` 只填文件名，不带路径。

> **`Repository` 填的是 GitHub 上的仓库名**（`pretty-log`），
> 不是 Gitee 地址。本仓库以 Gitee 为上游、由镜像同步到 GitHub，
> 但 OIDC 的信任绑定认的是 GitHub 那一侧。

### 确认 npm CLI 版本

Trusted Publishing 需要 **npm ≥ 11.5.1**，更早的版本没有 OIDC 交换逻辑。
工作流里已加 `npm install -g npm@latest` 显式升级——不要依赖 Node 捆绑的
npm 版本，它会随时间漂移。

### 清掉旧的 NPM_TOKEN

仓库里若还存着 `NPM_TOKEN` secret，**请到
GitHub Settings → Secrets and variables → Actions 删除它**。
OIDC 下它不再被引用，留着等于长期凭据白白躺在仓库里。

**为什么不需要 Gitee 令牌**：Gitee → GitHub 的仓库同步由 Gitee 侧的镜像
设置负责，CI 只需在被触发后完成发布，不需要回写任何分支。

---

## 日常发布

```sh
# 1. 把改动合并到 master
git checkout master
git pull
git merge dev          # 或走 Gitee 的 PR 流程

# 2. 本地确认通过
yarn install
yarn test:unit

# 3. 更新版本号（必须在打 tag 之前，否则校验会中止）
npm version patch       # 1.0.0 → 1.0.1（也可用 minor / major）

# 4. 推到 Gitee 并打 tag
git push origin master
git tag v1.0.1
git push origin v1.0.1
```

> ⚠️ **本批改动（主题 API 迁移 + 表格美化）是 breaking change**：
> 第 3 步升版请用 `npm version major`（0.x 阶段则 `npm version minor`）。
> 除升版幅度外，触发流程照旧。
> 行为注记：默认主题由固定 dark 改为环境自适应（浅色环境输出变浅色配色，属修复性行为变化）。

然后在 GitHub 上操作：

1. 进入仓库的 **Releases** 页面
2. 点 **Draft a new release**
3. **Choose a tag** → 选 `v1.0.1`（镜像已同步过来，能选到）
4. 填标题、说明
5. 点 **Publish release**

Actions 随之自动执行：

1. `verify-tag-version` 校验 tag 与 `package.json` 版本一致（不一致则中止）
2. 跑单元测试
3. 跑类型检查
4. 构建
5. 发布到 npm（`latest` tag）

---

## 版本号与 tag 不一致时会怎样

若 tag 是 `v1.2.0` 而 `package.json` 写的是 `1.1.0`，发布会在**第一步就中止**，
npm 上不会出现任何东西。

这是刻意设计的：npm 已发布的版本号无法回收，发错只能靠 dist-tag 临时补救。
两者对不上会让后续排查版本来源非常痛苦。

本地可先自查：

```sh
yarn verify:tag v1.2.0
```

---

## 为什么用 Release 事件而不是 tag push

直觉上应该监听 `push: tags`，但**在本仓库的链路上行不通**：

Gitee 镜像同步 tag 时走的是 GitHub API 写 ref，并非一次真实的 git push，
因此不产生 `push` 事件。实测：tag 与分支均已同步到 GitHub（`git ls-remote`
能查到 `v1.0.1`），但 GitHub API 查询 `actions/runs` 返回 `total_count: 0`
—— 仓库从未跑过任何 Actions。

而"创建 Release"是一个真实用户动作，会产生 `release` 事件，
且其 `GITHUB_REF` 为 `refs/tags/<tag_name>`，正好提供版本校验所需的 tag 名。

### 注意 created 而非 published

workflow 同时监听 `created` 与 `published`：

- 手动创建 Release（此前不是 draft）触发的是 **`created`**
- 先存 draft 再发布触发的是 `published`

（依据 GitHub 官方 webhook 文档：*Action type: created — A draft was saved,
or a release or pre-release was published without previously being saved as a draft.*）

只写 `types: [published]` 会导致手动发版时工作流不运行。

### 幂等保护

因为监听了两条路径，先存 draft 再发布时同一次发版可能被触发两次。
`check-version-published.js` 会在发布前查一次 npm：已发布则跳过并正常退出，
避免第二次发布因版本号冲突而失败。

## 关于同步方向

Gitee 是上游，GitHub 是镜像，**单向**：

```
本地 ──push──> Gitee（打 tag）──镜像──> GitHub ──触发──> Actions ──> npm
```

CI **不会**往 Gitee 或 GitHub 推送任何分支。这是有意为之：
分支同步由 Gitee 的镜像设置统一负责，CI 若参与推送会形成环，
且可能用陈旧代码覆盖上游。

如果哪天你希望反过来（以 GitHub 为上游发布），需要调整的是 Gitee 的镜像
方向，而不是这个工作流。

---

## 常见问题

**Q：推送 tag 后 Actions 没反应？**
A：三点可能——① tag 未以 `v` 开头（触发器只匹配 `v*`）；② Gitee 镜像尚未同步该 tag
（去 GitHub 的 tags 页面确认）；③ tag 指向的 commit 不在 GitHub 上（若该 commit
只推到了 GitHub 而没推到 Gitee，镜像无从获取）。

**Q：发布报 `ENEEDAUTH`？**

A：OIDC 下最常见的一种失败，且**报错信息具有误导性**——npm 在拿不到
`id_token` 时**不报错**，而是静默降级为「无凭据」状态，直到发布时才以
`ENEEDAUTH` 收场。看起来像认证坏了，实际通常是权限或版本问题。

按可能性从高到低排查：

| 原因 | 怎么确认 |
|---|---|
| `permissions` 里缺 `id-token: write` | 看 workflow 顶部；缺了它 GitHub 不会注入 `ACTIONS_ID_TOKEN_REQUEST_URL` |
| npm CLI < 11.5.1 | 诊断步骤会回显 `npm 版本` |
| Trusted Publisher 登记的仓库名/工作流名与实际不符 | 回 npm 包页面 Access 确认三项是否与 GitHub 上一致 |
| 登记时没勾 `Allow npm publish` | 同上，在 Allowed actions 一栏 |

**诊断步骤会一次性告诉你前两项**：先看 job summary 里的
`id-token 端点` 与 `npm 版本` 两行。

**Q：发布报 `E422`，提示 sigstore provenance 校验失败？**

A：`package.json` 的 `repository.url` 与实际发布仓库不一致。典型报错：

```
Error verifying sigstore provenance bundle: Failed to validate repository information:
package.json: "repository.url" is "https://gitee.com/wb04307201/pretty-log",
expected to match "https://github.com/wb04307201/pretty-log" from provenance
```

**为什么会校验**：npm 12 在 GitHub Actions + 公共仓库下**自动开启 provenance**
（npm CLI `lib/utils/oidc.js`：仅当 `provenance` 取默认值、仓库为 public 时
才 `opts.provenance = true`）。provenance 是供应链签名，npm registry 会校验
签名里记录的发布仓库与包元数据是否相符。

**解法**：把 `package.json` 的 `repository.url` 改成 GitHub 地址。
本仓库以 Gitee 为上游、镜像同步到 GitHub，但**发布发生在 GitHub**，
所以 `repository.url` / `bugs.url` / `homepage` 都指向 GitHub。

> 要关闭 provenance 只能显式传 `--no-provenance`（那会让
> `isDefaultProvenance` 为假）。但这是**供应链安全降级**，不建议；
> 正确做法是让元数据与实际发布仓库一致。

**Q：发布报 `E403` 或 `401`？**
A：与 OIDC 无关，是 npm 侧的账号策略在拒绝。`E403` 通常是包的
**Publishing access** 选项与所用凭据冲突（页面提示：trusted publisher
与各选项都兼容，若仍报错说明绑定本身没生效）。

**Q：为什么不用 setup-node 的 registry-url？**

OIDC 下**根本不需要** `.npmrc`，加了反而会坏事：

1. `registry-url` 会让 setup-node 生成一份含 `${NODE_AUTH_TOKEN}` 的 `.npmrc`，
   并把 `NPM_CONFIG_USERCONFIG` 导出为**整个 job 全局生效**。
2. 本工作流的「安装依赖」步骤用 **yarn 1**，且跑在发布步骤之前。
3. yarn 1 读到 `.npmrc` 里无法替换的 `${...}` 变量时，直接抛
   `Failed to replace env in config` 并中止 —— 连零依赖的空包都装不上。

也就是说，加了它会把失败点从「发布时认证失败」提前到「安装依赖时就崩」，
看起来像是修好了认证，实际整个流程根本走不到发布。

（这段坑是真的踩过：修复认证的第一版就用了 `registry-url`，
结果把失败点从发布提前到了装依赖。`test/workflow-contract.test.js`
里有一条用例专门断言 `registry-url` 不得出现。）

**Q：`yarn install --frozen-lockfile` 报错？**
A：`package.json` 与 `yarn.lock` 不一致。本地跑
`yarn install && git add yarn.lock` 同步后再推。

**Q：首次发版该用��么版本号？**
A：建议补丁版本（如 `v1.0.1`）试水。npm 上已发布的版本号无法重用，
一旦发到一半失败，该版本号就永久浪费了。

**Q：需要手动发版怎么办（CI 挂了但急用）？**
A：仍可手动发布，`prepublishOnly` 会自动跑测试与类型检查：

```sh
yarn build && npm publish --access public --registry https://registry.npmjs.org/
```

**Q：`rimraf` 这个依赖还需要吗？**
A：不需要了。原先的 `release` 脚本用它清理 `dist/`，现由 CI 承担。
依赖暂未从 `package.json` 移除，留待后续清理。