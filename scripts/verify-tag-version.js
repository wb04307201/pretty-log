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
    console.error('[verify-tag-version] 已中止发布。请同步 tag 与 package.json 后重新打 tag。');
    process.exit(1);
  }

  console.log(`[verify-tag-version] tag ${tag} 与 package.json 版本 ${pkg.version} 一致`);
}

module.exports = { parseTagVersion };

if (require.main === module) main();