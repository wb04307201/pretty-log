/**
 * 把 console 输出渲染到页面上的调试面板
 *
 * pretty-log 走的是 console.log('%c 标题 \n%c 内容 ', style1, style2)：
 * 格式串里用 %c 占位，后续实参是 CSS 串。本模块拦截 console 的各个方法，
 * 把同样的参数还原成 DOM —— 按 %c 切分文本、把对应 CSS 应用到每个片段，
 * 格式串里的 \n 按行拆开（框间用 <br> 断行，见 renderArgs），
 * 因此页面上的效果与真实控制台基本一致，图片日志（picture）也能正常显示。
 *
 * 原生 console 调用依然透传，开发者工具里的行为不受影响。
 *
 * 主题（黑白底）与 pretty-log 的 mode 成对联动：mode 决定 texts 等预设色
 * 取深底还是浅底值，只换底不换 mode 会看到浅底色值浮在黑底上，与真实
 * 控制台同主题的观感不符。默认底色跟随系统（同 mode 的解析规则），
 * 切换按钮会落盘并刷新重放演示日志——行的颜色在打印瞬间已定，
 * 只有重打才能让全部行在新主题下成对渲染。见 applyTheme。
 */

/** 最多保留的条目数，防止长时间运行拖慢页面 */
const MAX_ENTRIES = 800

let panelEl = null
let listEl = null
let counterEl = null
let scrollEl = null
let themeBtn = null

/** 当前所在的容器栈，栈底是列表本身；group 时入栈、groupEnd 时出栈 */
const containerStack = []

/** 保存原生 console 方法，便于透传与恢复 */
const nativeConsole = {}

/** 记录原始方法名，供点击"清空"后重建 DOM 使用 */
const HOOKED_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'group', 'groupCollapsed', 'groupEnd', 'table']

let entryCount = 0
let autoScroll = true

/**
 * 创建元素的小工具
 */
const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * 解析 console 的格式串与样式实参，还原成 [{text, style}]
 *
 * 需要正确区分两种百分号：
 *   %c  —— 格式符，接下来的实参是 CSS
 *   %%  —— 转义后的字面百分号（pretty-log 会把内容里的 % 转义成 %%）
 *
 * 若直接按 '%c' 切分，遇到内容里的字面 '%' 会被误判成格式符而错位，
 * 故这里逐字符扫描，成对消费 '%%'。
 */
const parseFormat = (format, styles) => {
  const segments = []
  let buffer = ''
  let style = null
  let styleIndex = 0
  let i = 0

  while (i < format.length) {
    const char = format[i]

    if (char === '%' && format[i + 1] === '%') {
      buffer += '%'
      i += 2
      continue
    }

    if (char === '%' && format[i + 1] === 'c') {
      segments.push({ text: buffer, style })
      buffer = ''
      style = styles[styleIndex] ?? null
      styleIndex += 1
      i += 2
      continue
    }

    buffer += char
    i += 1
  }
  segments.push({ text: buffer, style })
  return segments
}

/**
 * 把 console 实参渲染成 DocumentFragment
 *
 * 每个 %c 片段渲染成一个 inline-block span —— 只有 inline-block 才能让
 * padding / border / background-image 生效，picture() 打印的图片正是
 * 靠 font-size:1px + padding + background-image 实现的。
 */
const renderArgs = (args) => {
  const fragment = document.createDocumentFragment()
  const [first, ...rest] = args

  if (typeof first !== 'string') {
    // 非字符串首参（对象、数组等）：退化为可读文本
    for (const arg of args) {
      const span = el('span', 'pl-seg')
      span.textContent = typeof arg === 'object' ? safeStringify(arg) : String(arg)
      fragment.appendChild(span)
    }
    return fragment
  }

  const styles = rest.filter((arg) => typeof arg === 'string')
  for (const segment of parseFormat(first, styles)) {
    // 每段文本按 \n 拆行、行间放 <br>：prettyPrint 在每段内容前都放一个
    // \n（见 src/index.ts 的 prettyPrint），真实控制台按 \n 断行、每个色框
    // 各占一行。色框本身是 inline-block（padding/border/图片要靠它），
    // 行尾 \n 会被 inline-block 自己的格式化上下文吞掉，换行只能由框外的
    // <br> 完成。内容内部的 \n 同理拆成多个同样式片段、各自成框——
    // 与控制台行内边框逐行包边的行为一致。
    const lines = segment.text.split('\n')
    lines.forEach((line, index) => {
      if (index > 0) fragment.appendChild(el('br'))
      if (line === '') return
      const span = el('span', 'pl-seg', line)
      if (segment.style) span.style.cssText = segment.style
      fragment.appendChild(span)
    })
  }
  return fragment
}

/**
 * 安全地序列化对象（循环引用不抛错）
 */
const safeStringify = (value) => {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/**
 * 表格单元格文本
 */
const formatCell = (value) => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'object') return safeStringify(value)
  return String(value)
}

/**
 * 渲染 console.table：数组取并集列，单对象/基本值则单列展示
 */
const renderTable = (data) => {
  const rows = Array.isArray(data) ? data : [data]
  const wrap = el('div', 'pl-table-wrap')
  const table = el('table', 'pl-table')

  const first = rows[0]
  if (rows.length > 0 && typeof first === 'object' && first !== null && !Array.isArray(first)) {
    const columns = []
    for (const row of rows) {
      if (row && typeof row === 'object') {
        for (const key of Object.keys(row)) {
          if (!columns.includes(key)) columns.push(key)
        }
      }
    }

    const thead = el('thead')
    const headRow = el('tr')
    headRow.appendChild(el('th', null, ''))
    for (const column of columns) headRow.appendChild(el('th', null, column))
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = el('tbody')
    rows.forEach((row, index) => {
      const tr = el('tr')
      tr.appendChild(el('td', 'pl-idx', String(index)))
      for (const column of columns) {
        tr.appendChild(el('td', null, formatCell(row?.[column])))
      }
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
  } else {
    const tbody = el('tbody')
    rows.forEach((value, index) => {
      const tr = el('tr')
      tr.appendChild(el('td', 'pl-idx', String(index)))
      tr.appendChild(el('td', null, formatCell(value)))
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
  }

  wrap.appendChild(table)
  return wrap
}

const currentContainer = () => containerStack[containerStack.length - 1]

const scrollToBottom = () => {
  if (autoScroll && scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
}

/**
 * 超出上限时从最早的开始移除，避免 DOM 无限增长
 */
const trimEntries = () => {
  while (entryCount > MAX_ENTRIES) {
    const first = listEl.firstElementChild
    if (!first) break
    first.remove()
    entryCount -= 1
  }
}

const updateCounter = () => {
  if (counterEl) counterEl.textContent = String(entryCount)
}

/**
 * 追加一条普通日志
 */
const addEntry = (kind, args) => {
  const row = el('div', `pl-row pl-${kind}`)
  row.appendChild(renderArgs(args))
  currentContainer().appendChild(row)
  entryCount += 1
  trimEntries()
  updateCounter()
  scrollToBottom()
}

/**
 * 打开一个分组。分组体作为新的当前容器，groupEnd 时出栈。
 * 默认折叠，点击标题可展开/折叠。
 */
const openGroup = (args) => {
  const box = el('div', 'pl-group')
  const head = el('div', 'pl-group-head')
  head.appendChild(renderArgs(args))
  const body = el('div', 'pl-group-body')

  // 默认折叠：group 往往是补充信息，全展开会把关键日志挤出视野。
  // 需要看内容时点标题展开即可。collapsed 参数为 true 时同样折叠。
  body.style.display = 'none'
  head.title = '点击展开/折叠'
  head.addEventListener('click', () => {
    body.style.display = body.style.display === 'none' ? '' : 'none'
  })

  box.appendChild(head)
  box.appendChild(body)
  currentContainer().appendChild(box)
  containerStack.push(body)
}

const closeGroup = () => {
  if (containerStack.length > 1) containerStack.pop()
}

/**
 * 切换面板黑白主题（底色 + 库 mode 一起切）。
 *
 * setTheme({ mode }) 只切预设，不动用户的其它主题覆盖；
 * 这样「底色 ↔ 预设色」始终成对，等价于预览一台同主题的真实控制台。
 */
const applyTheme = (light) => {
  panelEl.classList.toggle('theme-light', light)
  if (themeBtn) themeBtn.textContent = light ? '主题：白' : '主题：黑'
  window.prettyLog?.setTheme?.({ mode: light ? 'light' : 'dark' })
}

/**
 * 记住用户点选的主题，刷新后保持（仅用户点击落盘；
 * 未点选时默认跟随系统，不写入）。
 */
const persistTheme = (light) => {
  try {
    localStorage.setItem('pl-panel-theme', light ? 'light' : 'dark')
  } catch {
    // localStorage 不可用（隐私模式等）时静默，主题切换照常工作
  }
}

/**
 * 按 console 方法名分发
 */
const handle = (method, args) => {
  switch (method) {
    case 'group':
      openGroup(args)
      break
    case 'groupCollapsed':
      openGroup(args)
      break
    case 'groupEnd':
      closeGroup()
      break
    case 'table':
      addEntry('table', [])
      listEl.lastElementChild?.appendChild(renderTable(args[0]))
      updateCounter()
      scrollToBottom()
      break
    default:
      addEntry(method, args)
  }
}

/**
 * 构建面板 DOM
 */
const buildPanel = () => {
  panelEl = el('section', '')
  panelEl.id = 'console-panel'

  const header = el('header')
  header.appendChild(el('strong', null, 'Console 输出'))
  counterEl = el('span', 'pl-count', '0')
  header.appendChild(counterEl)

  const toggleScroll = el('button', 'pl-btn', '自动滚动：开')
  toggleScroll.addEventListener('click', () => {
    autoScroll = !autoScroll
    toggleScroll.textContent = `自动滚动：${autoScroll ? '开' : '关'}`
    if (autoScroll) scrollToBottom()
  })
  header.appendChild(toggleScroll)

  const clearBtn = el('button', 'pl-btn', '清空')
  clearBtn.addEventListener('click', () => {
    listEl.replaceChildren()
    containerStack.length = 0
    containerStack.push(listEl)
    entryCount = 0
    updateCounter()
  })
  header.appendChild(clearBtn)

  // 黑白主题切换：按钮文案显示当前主题（与"自动滚动"同为状态式）。
  // 点选落盘后刷新重放演示日志——行的颜色在打印瞬间已定，只有重打
  // 才能让全部行在新主题下成对渲染（底色 ↔ 预设色，见 applyTheme）。
  themeBtn = el('button', 'pl-btn', '主题：黑')
  themeBtn.addEventListener('click', () => {
    persistTheme(!panelEl.classList.contains('theme-light'))
    location.reload()
  })
  header.appendChild(themeBtn)
  // 未点选过则跟随系统（与库的 mode 解析规则一致），点选过则用点选值
  let savedTheme = null
  try {
    const saved = localStorage.getItem('pl-panel-theme')
    if (saved === 'light' || saved === 'dark') savedTheme = saved
  } catch {
    // 同上
  }
  const systemLight = typeof matchMedia === 'function'
    ? matchMedia('(prefers-color-scheme: light)').matches
    : true
  applyTheme(savedTheme === null ? systemLight : savedTheme === 'light')

  // 全屏 / 半屏 / 收起 三态循环
  const sizeBtn = el('button', 'pl-btn', '全屏')
  const SIZES = [
    { label: '全屏', apply: () => panelEl.classList.remove('is-half', 'is-minimized') },
    { label: '半屏', apply: () => {
      panelEl.classList.remove('is-minimized')
      panelEl.classList.add('is-half')
    } },
    { label: '收起', apply: () => {
      panelEl.classList.remove('is-half')
      panelEl.classList.add('is-minimized')
    } },
  ]
  let sizeIndex = 0
  sizeBtn.addEventListener('click', () => {
    // 收起时按钮指向"恢复到全屏"——收起状态下无法预判用户想回去哪一档，
    // 回全屏是最安全的选择；不展开时则按 全屏→半屏→收起 顺序轮转。
    if (panelEl.classList.contains('is-minimized')) {
      sizeIndex = 0
    } else {
      sizeIndex = (sizeIndex + 1) % SIZES.length
    }
    SIZES[sizeIndex].apply()
    sizeBtn.textContent = SIZES[sizeIndex].label
    scrollToBottom()
  })
  header.appendChild(sizeBtn)

  listEl = el('div', '')
  listEl.id = 'console-output'
  scrollEl = listEl

  panelEl.appendChild(header)
  panelEl.appendChild(listEl)

  containerStack.length = 0
  containerStack.push(listEl)

  document.body.appendChild(panelEl)
  document.body.classList.add('has-console-panel')
}

/**
 * 安装面板：拦截 console 并渲染到页面，同时透传给原生实现
 *
 * @returns {HTMLElement|null} 面板元素，重复调用返回同一个
 */
export const installConsolePanel = () => {
  if (panelEl) return panelEl
  if (typeof document === 'undefined') return null

  buildPanel()

  for (const method of HOOKED_METHODS) {
    nativeConsole[method] = console[method]
    console[method] = (...args) => {
      try {
        handle(method, args)
      } catch {
        // 面板渲染失败不应影响真实日志输出
      }
      return nativeConsole[method].apply(console, args)
    }
  }

  return panelEl
}

export default installConsolePanel
