# @wb04307201/pretty-log

> 一个前端工具包，用于美化控制台日志输出。它可以帮助开发者在浏览器控制台中以更清晰、更易读的格式输出日志信息。

[简体中文](README.zh-CN.md) | [English](README.md)

[![NPM](https://nodei.co/npm/@wb04307201/pretty-log.png)](https://nodei.co/npm/@wb04307201/pretty-log/)

## 安装
```sh
npm install @wb04307201/pretty-log
```

## 使用
```javascript
import * as prettyLog from '@wb04307201/pretty-log';

// 信息
prettyLog.info("Hello world!")
prettyLog.info("自定义标题", "Hello world!")

// 错误
prettyLog.error("Hello world!")
prettyLog.error("错误标题", "出错了!")

// 警告
prettyLog.warning("Hello world!")
prettyLog.warning("警告标题", "请小心!")

// 成功
prettyLog.success("Hello world!")
prettyLog.success("成功标题", "操作完成!")

// 调试
prettyLog.debug("调试信息")
prettyLog.debug("调试标题", "详细调试数据", {verbose: true})

// 彩虹
prettyLog.rainbow("来 左边 跟我一起画个龙在你右边 画一道彩虹")

// 组输出，默认展开
prettyLog.group("一个组输出", ["组内容1", "组内容2", "组内容3"])

// 组输出，折叠
prettyLog.group("一个组输出", ["组内容1", "组内容2", "组内容3"], false)

// 表格
prettyLog.table([{a: 1, b: 1, c: 1}, {a: 2, b: 2, c: 2}, {a: 3, b: 3, c: 3}])

// 计时器
prettyLog.time('myTimer');
// 执行一些操作...
setTimeout(() => {
    prettyLog.timeEnd('myTimer');
}, 2000); // 2000 毫秒 = 2 秒

// 图片
prettyLog.picture("https://example.com/image.png", 0.2)

// JSON 格式
prettyLog.info({a: 100, b: {b1: '一一一', b2: '二二二'}, c: [5, 6, 7]})
prettyLog.info("JSON", {a: 100, b: {b1: '一一一', b2: '二二二'}, c: [5, 6, 7]})
```

## 高级功能

### 日志级别过滤
```javascript
// 只显示 warn 及以上级别（debug 和 info 被过滤）
prettyLog.setLogLevel('warn');
prettyLog.debug('不会显示');
prettyLog.warning('会显示');

// 级别: 'debug' < 'info' < 'warn' < 'error' < 'none'
prettyLog.setLogLevel('none');  // 关闭所有输出
```

### Emoji 前缀
```javascript
prettyLog.showEmoji(true);
prettyLog.info("带 Emoji");   // ℹ️ Info ...
prettyLog.error("出错了");    // ❌ Error ...
prettyLog.showEmoji(false);   // 关闭
```

### 时间戳
```javascript
prettyLog.showTimestamp(true);
prettyLog.info("带时间戳");  // [14:32:05.123] Info ...
```

### 自定义主题
```javascript
prettyLog.setTheme({
  infoColor: '#00FF00',
  errorColor: '#FF0000',
  groupColor: '#FF00FF',
});
```

### 一次性配置
```javascript
prettyLog.configure({
  logLevel: 'info',
  showEmoji: true,
  showTimestamp: true,
  theme: { infoColor: '#00FF00' },
});
```

### 日志历史
```javascript
// 获取最近的日志记录（默认缓存最近 200 条）
const history = prettyLog.getHistory();
console.log(JSON.stringify(history, null, 2));

// 调整历史记录大小（设为 0 禁用）。
// 非法值会被自动夹紧而不会抛异常，且调整容量时会保留已有记录
//（缩容时保留最近的若干条）。
prettyLog.setHistorySize(500);

// 清空历史
prettyLog.clearHistory();
```

### 异步计时器
`timer` 在正常与抛错/拒绝两条路径上都会结束计时，且不会吞掉原始异常。
```javascript
// 同步任务 —— 立即输出
const result = prettyLog.timer('parse', () => JSON.parse(raw));

// 异步任务 —— Promise 结束后输出
await prettyLog.timer('fetch-user', () => fetch('/api/user').then(r => r.json()));

// 即使抛错也会结束计时，异常继续向上传递
await prettyLog.timer('risky', () => Promise.reject(new Error('boom')));
```

### 只输出一次
适合写在循环里的调试日志，同一个 key 只会打印一次。
```javascript
for (const item of items) {
  prettyLog.once('render', '组件已渲染', item.id);
}

prettyLog.clearOnce();  // 清空记录，所有 key 可重新输出
```

### 调用计数
```javascript
items.forEach(i => prettyLog.count('api-call'));

console.log(prettyLog.countSummary());  // { 'api-call': 42 }
prettyLog.clearCounters();
```

### 带前缀的 logger
返回一组带固定前缀的日志函数，级别、主题与过滤规则与标准日志函数一致。
```javascript
const userLog = prettyLog.withPrefix('用户模块');
userLog.info('登录成功', { userId: 123 });
// [用户模块] 登录成功
// {"userId":123}
```

### 断言
条件成立时静默；失败时走 `console.error`（DevTools 中标红）并抛出异常。
```javascript
prettyLog.assert(user != null, 'user 不能为空');
```

### 自定义样式
```javascript
prettyLog.setStyles({ borderRadius: '8px', padding: '3px 10px' });

// 传 undefined 恢复默认
prettyLog.setStyles({ borderRadius: undefined });
```

### 生产环境剥离
当 `NODE_ENV=production` 时，全部日志 API 退化为静默 no-op，
调试代码可以留在源码里而不会污染线上包。
```javascript
// 生产环境下不会输出
prettyLog.info('这条不会出现');
```

注意：生产环境下 `timer` 仍会执行你传入的函数，只是日志被抑制。

## 输出
![img.png](https://github.com/wb04307201/pretty-log/blob/master/img.png?raw=true)
