# 发布流程

本项目采用 **git tag 驱动的自动发布**：在 Gitee 打一个形如 `v1.2.3` 的 tag，
Gitee 的镜像设置会把它同步到 GitHub，GitHub Actions 随即自动完成
校验、测试、构建、发布到 npm。

---

## 一次性准备：配置仓库 Secrets

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加**一个** Secret：

| Secret | 用途 |
|---|---|
| `NPM_TOKEN` | 发布到 npm |

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

# 3. 更新版本号
npm version patch       # 1.0.0 → 1.0.1（也可用 minor / major）

# 4. 推到 Gitee 并打 tag
git push origin master
git tag v1.0.1
git push origin v1.0.1
```

`git push origin v1.0.1` 之后，Gitee 镜像会把 tag 同步到 GitHub，
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
A：`NPM_TOKEN` 无效或过期。确认变量名是大写的 `NPM_TOKEN`——
npm 只认这个名字，换成 `NODE_AUTH_TOKEN` 不会生效。

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