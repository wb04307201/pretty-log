/**
 * 校验 git tag 与 package.json 的 version 是否一致
 *
 * CI 在发布 npm 前必须跑这个检查：tag 说 v1.2.0 而包里写 1.1.0 时，
 * 发出去的包与 git 历史会对不上，之后再想修正必须动 dist-tag，
 * 且已发布的版本号无法回收。
 *
 * 用法：
 *   node scripts/verify-tag-version.js v1.2.0
 *   node scripts/verify-tag-version.js            # 回退到 CI 的 GITHUB_REF_NAME
 *
 * 退出码：0 一致 / 1 不一致或格式错误
 */

const fs = require('node:fs');
const path = require('node:path');

/** 从形如 v1.2.3-beta.1 中取出 1.2.3-beta.1 */
function parseTagVersion(tag) {
  const match = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/.exec(tag ?? '');
  return match ? match[1] : null;
}

function main() {
  const tag = process.argv[2] || process.env.GITHUB_REF_NAME || '';
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const errors = [];

  if (!tag) {
    console.error('[verify-tag-version] 缺少 tag 参数');
    process.exit(1);
  }

  const tagVersion = parseTagVersion(tag);
  if (!tagVersion) {
    errors.push(`tag "${tag}" 不是合法的版本标签（期望形如 v1.2.3 或 v1.2.3-beta.1）`);
  }

  if (tagVersion && tagVersion !== pkg.version) {
    errors.push(`版本不一致：tag 为 ${tagVersion}，package.json 为 ${pkg.version}`);
  }

  if (errors.length > 0) {
    for (const e of errors) console.error(`[verify-tag-version] ${e}`);
    console.error('');
    console.error('[verify-tag-version] 已中止发布。修复方式（二选一）：');
    console.error(`  A. 若 ${pkg.version} 就是你想发布的版本，改 tag 名：`);
    console.error(`       git tag -d ${tag} && git tag v${pkg.version}`);
    console.error(`       git push origin :refs/tags/${tag} && git push origin v${pkg.version}`);
    console.error(`     然后到 GitHub 为 v${pkg.version} 重新创建 Release。`);
    console.error(`  B. 若 ${tagVersion ?? tag} 才是目标版本，先改 package.json 再重打 tag：`);
    console.error(`       npm version ${tagVersion ?? '<版本>'}`);
    console.error(`       git commit -am "chore: 版本号升至 ${tagVersion ?? '<版本>'}"`);
    console.error(`       git push origin master && git tag -d ${tag} && git tag ${tag}`);
    console.error(`       git push origin :refs/tags/${tag} && git push origin ${tag}`);
    console.error('');
    console.error('[verify-tag-version] 注意：npm 上已发布的版本号无法回收，');
    console.error('[verify-tag-version] 请确认后再重打，避免浪费版本号。');
    process.exit(1);
  }

  console.log(`[verify-tag-version] tag ${tag} 与 package.json 版本 ${pkg.version} 一致`);
}

module.exports = { parseTagVersion };

if (require.main === module) main();