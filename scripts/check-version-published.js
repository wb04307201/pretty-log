#!/usr/bin/env node
/**
 * 发布前的幂等检查：该版本是否已存在于 npm
 *
 * workflow 同时监听 release 的 created 与 published 事件（手动创建
 * Release 触发 created，先存 draft 再发布触发 published）。若两者都发生，
 * 同一次发版可能被跑两遍，而 npm 的版本号无法覆盖 —— 第二次会失败。
 * 故发布前先查一次，已存在则以 exit 0 优雅跳过。
 *
 * 用法：node scripts/check-version-published.js <version>
 * 退出码：0 已发布（应跳过）/ 1 未发布（可继续）/ 2 检查失败（保守中止）
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const PKG_NAME = require(path.join(__dirname, '..', 'package.json')).name;

/**
 * npm 的可执行文件名
 *
 * Windows 上 npm 是 npm.cmd 包装脚本，直接 execFileSync('npm') 会 ENOENT；
 * Linux/macOS 则是 npm。CI（ubuntu-latest）与本地开发都可能命中前者。
 */
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function main() {
  const version = process.argv[2];
  if (!version) {
    console.error(`[check-version-published] 缺少版本参数（包名：${PKG_NAME}）`);
    process.exit(2);
  }

  try {
    execFileSync(NPM_BIN, ['view', `${PKG_NAME}@${version}`, 'version'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      // npm 在 Windows 上是 .cmd 批处理，Node 无法直接 spawn（EINVAL），
      // 必须经 shell 调用。参数固定且不含用户输入，无注入风险。
      shell: true,
    });
    console.log(
      `[check-version-published] ${PKG_NAME}@${version} 已发布，跳过本次发布`
    );
    process.exit(0);
  } catch (error) {
    // npm view 对不存在的包/版本返回非 0，视为"未发布"。
    // ENOENT 说明连 npm 都调不起来，属环境问题，必须保守中止而非误判为未发布。
    const code = error && (error.code || error.status);
    if (code === 1 || code === 2) {
      console.log(`[check-version-published] ${PKG_NAME}@${version} 尚未发布，可继续`);
      process.exit(1);
    }
    console.error(
      `[check-version-published] 查询 npm 失败（code=${code}），保守中止以免重复发布`
    );
    process.exit(2);
  }
}

if (require.main === module) main();
