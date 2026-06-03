# @wb04307201/pretty-log

> A frontend toolkit for beautifying console log output. It helps developers display log information in a cleaner, more readable format in the browser console.

[简体中文](README.zh-CN.md) | [English](README.md)

[![NPM](https://nodei.co/npm/@wb04307201/pretty-log.png)](https://nodei.co/npm/@wb04307201/pretty-log/)

## Installation
```sh
npm install @wb04307201/pretty-log
```

## Usage
```javascript
import * as prettyLog from '@wb04307201/pretty-log';

// Info
prettyLog.info("Hello world!")
prettyLog.info("Custom Title", "Hello world!")

// Error
prettyLog.error("Hello world!")
prettyLog.error("Error Title", "Something went wrong!")

// Warning
prettyLog.warning("Hello world!")
prettyLog.warning("Warning Title", "Be careful!")

// Success
prettyLog.success("Hello world!")
prettyLog.success("Success Title", "Operation completed!")

// Debug
prettyLog.debug("Debug message")
prettyLog.debug("Debug Title", "Detailed debug data", {verbose: true})

// Rainbow
prettyLog.rainbow("Colorful rainbow text in the console")

// Group output, expanded by default
prettyLog.group("A Group", ["Item 1", "Item 2", "Item 3"])

// Group output, collapsed
prettyLog.group("A Collapsed Group", ["Item 1", "Item 2", "Item 3"], false)

// Table
prettyLog.table([{a: 1, b: 1, c: 1}, {a: 2, b: 2, c: 2}, {a: 3, b: 3, c: 3}])

// Timer
prettyLog.time('myTimer');
// Do some work...
setTimeout(() => {
    prettyLog.timeEnd('myTimer');
}, 2000); // 2000 ms = 2 seconds

// Image
prettyLog.picture("https://example.com/image.png", 0.2)

// JSON format
prettyLog.info({a: 100, b: {b1: 'one', b2: 'two'}, c: [5, 6, 7]})
prettyLog.info("JSON", {a: 100, b: {b1: 'one', b2: 'two'}, c: [5, 6, 7]})
```

## Advanced Features

### Log Level Filtering
```javascript
// Only show warn and above (debug and info are filtered out)
prettyLog.setLogLevel('warn');
prettyLog.debug('will not show');
prettyLog.warning('will show');

// Levels: 'debug' < 'info' < 'warn' < 'error' < 'none'
prettyLog.setLogLevel('none');  // Disable all output
```

### Emoji Prefix
```javascript
prettyLog.showEmoji(true);
prettyLog.info("With emoji");   // ℹ️ Info ...
prettyLog.error("An error");    // ❌ Error ...
prettyLog.showEmoji(false);     // Disable
```

### Timestamp
```javascript
prettyLog.showTimestamp(true);
prettyLog.info("With timestamp");  // [14:32:05.123] Info ...
```

### Custom Theme
```javascript
prettyLog.setTheme({
  infoColor: '#00FF00',
  errorColor: '#FF0000',
  groupColor: '#FF00FF',
});
```

### One-Shot Configuration
```javascript
prettyLog.configure({
  logLevel: 'info',
  showEmoji: true,
  showTimestamp: true,
  theme: { infoColor: '#00FF00' },
});
```

### Log History
```javascript
// Get recent log entries (default buffer size: 200)
const history = prettyLog.getHistory();
console.log(JSON.stringify(history, null, 2));

// Adjust history size (set to 0 to disable)
prettyLog.setHistorySize(500);

// Clear history
prettyLog.clearHistory();
```

## Output
![img.png](https://github.com/wb04307201/pretty-log/blob/master/img.png?raw=true)
