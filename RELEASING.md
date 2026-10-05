# 发布流程

本项目采用 **GitHub Release 驱动的自动发布**：

在 Gitee 打一个形如 `v1.2.3` 的 tag → Gitee 镜像把它同步到 GitHub →
你在 GitHub 上为该 tag 创建一个 Release → Actions 自动完成校验、测试、
构建、发布到 npm。

---

## 一次性准备：配置仓库 Secrets

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加**一个** Secret：

| Secret | 用途 |
|---|---|
| `NPM_TOKEN` | 发布到 npm（工作流内部转交给 npm 时用的是 `NODE_AUTH_TOKEN`，见下方说明） |

**为什么只要这一个**：Gitee → GitHub 的仓库同步由 Gitee 侧的镜像设置负责，
CI 只需在被触发后完成发布，不需要回写任何分支，因此不需要 Gitee 令牌。

**npm token 怎么生成**：npmjs.com → 右上角头像 → Access Tokens → Generate。

选 **Granular** 类型（不要用 Classic）：

| 项 | 填什么 |
|---|---|
| Token name | 如 `pretty-log-ci` |
| Expiration | 建议 90 天 |
| Packages | 勾选，Package name 填 `@wb04307201/pretty-log`，权限 **Read and write** |
| 其余权限 | 全部不勾 |

Granular token 只对这个包有效；Classic token 的 `publish` 权限覆盖整个 npm 账号。

> 令牌值**只能**填在 GitHub Secrets 里，不要写进仓库任何文件。

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

**Q：发布报 `ENEEDAUTH` 或 401？**

A：先分清是哪一个，两者含义完全不同：

| 报错 | 含义 | 查什么 |
|---|---|---|
| `ENEEDAUTH`（need auth） | npm **本地**就没找到凭据，请求根本没发出去 | 发布步骤是否写了 `$RUNNER_TEMP/npmrc`；`NODE_AUTH_TOKEN` 是否为空 |
| `E401`（Unauthorized） | 凭据发出去了但被拒 | `NPM_TOKEN` 是否过期、是否仍是 Granular 类型、Packages 里是否仍勾选了 `@wb04307201/pretty-log` 且权限为 Read and write |

工作流里的「诊断认证状态」步骤会把这两项事实直接打进 job summary，
先看那里能省掉大部分猜测。

> **一个容易踩的坑**：npm 不读 `NPM_TOKEN` 这类环境变量，它只从 `.npmrc`
> 的 `_authToken` 行取凭据。所以工作流内部传给 npm 的环境变量叫
> `NODE_AUTH_TOKEN`（要与 `.npmrc` 里写的 `${NODE_AUTH_TOKEN}` 一致），
> 而 GitHub Secret 仍叫 `NPM_TOKEN`。两个名字不一样是正常的。

### 为什么不用 setup-node 的 registry-url

GitHub 官方文档推荐的写法是给 `actions/setup-node` 加 `registry-url`：

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '24'
    registry-url: 'https://registry.npmjs.org'
```

**本仓库刻意不用它**，因为它会让发布流程整体失败：

1. `registry-url` 会让 setup-node 生成一份含 `${NODE_AUTH_TOKEN}` 的 `.npmrc`，
   并把 `NPM_CONFIG_USERCONFIG` 导出为**整个 job 全局生效**。
2. 本工作流的「安装依赖」步骤用 **yarn 1**，且跑在发布步骤之前、拿不到令牌。
3. yarn 1 读到 `.npmrc` 里无法替换的 `${...}` 变量时，直接抛
   `Failed to replace env in config` 并中止 —— 连空依赖的包都装不上。

也就是说，加了 `registry-url` 会把失败点从「发布时认证失败」提前到
「安装依赖时就崩」，看起来像是修好了认证，实际整个流程根本走不到发布。

因此本仓库改为**只在需要凭据的两个步骤内现建 `.npmrc`**，
并用 `NPM_CONFIG_USERCONFIG=... npm publish` 临时指定，不跨步骤泄漏。

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