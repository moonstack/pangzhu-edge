// 旁注 UI 文案(中/英)。仅界面壳;发给 Claude 的提示词不在此处。
// 值可以是字符串,或接受参数的函数(用于带变量的句子)。
export const UI = {
  '中': {
    // header
    langTitle: '切换界面与回答语言(中 / EN)',
    settings: '设置',
    newChat: '新对话',
    // context bar
    ctxbarTitle: '正在读哪个页面',
    ctxCurrent: '当前页面…',
    lockedTitle: '已锁定:切标签页不影响。点此解锁,跟随当前页',
    lockedPage: '(已锁定页面)',
    lockTitle: '锁定当前页面(之后切标签页不影响)',
    // quickbar
    chip_summary: '总结', chip_translate: '翻译', chip_keypoints: '要点',
    chip_outline: '大纲', chip_data: '挑数据', chip_factcheck: '核查',
    multitab: '多页对比', multitabTitle: '对比当前窗口打开的多个网页',
    // act bar
    actLabel: '动手',
    actDirWrapTitle: '工作目录:只能在此目录内读写文件,不会执行命令',
    actEdit: '改', actEditTitle: '修改工作目录',
    // empty state
    emptyHtml: '上方一键处理这一页,<br/>或在下面就这页直接发问。',
    // composer
    placeholder: '就这页问点什么…',
    placeholderAct: '让它在工作目录内做点什么…(先给计划,你批准后才动手)',
    webOnTitle: '联网搜索已开启(再点关闭)',
    webOffTitle: '联网搜索:让 Claude 上网查证(较慢,走你的订阅)',
    actModeTitle: '动手:让它在指定目录内读写文件(计划→批准→执行)',
    visionOnTitle: '已开启:发送时附带当前屏幕截图',
    visionOffTitle: '带截图(让它看这一屏)',
    send: '发送', stop: '停止',
    // roles / copy
    roleUser: '我', copy: '复制', copied: '已复制', copyFail: '复制失败',
    // status line
    stConnecting: '连接中…',
    stConnectFail: (e) => '无法连接本地小帮手:' + e,
    stDisconnected: (e) => '未连接' + (e ? '(' + e + ')' : '') + ' — 请重跑 install.cmd 并彻底重启 Edge',
    stConnected: '已连接 ✓',
    stLockedClosed: '锁定的标签页已关闭,已切回当前页',
    stNoTabToLock: '没有可锁定的标签页',
    stReadingTabs: (n) => '正在读取 ' + n + ' 个标签页…',
    stNeed2: '当前窗口可读网页不足 2 个',
    stNoContent: '没有读到任何可用网页内容',
    stPlanReady: '计划就绪 — 请审阅后批准',
    stActError: (m) => '动手出错:' + (m || ''),
    stActStopped: '已停止动手',
    stAnswering: '回答中…',
    stThinking: '思考中…(首次约 10 秒)',
    stStopped: '已停止',
    stBusyAnswer: '正在回答中,先点 ■ 停止',
    stBusyAct: '正在动手中,先点 ■ 停止',
    stChatFallback: '提示:此页无法读取内容,已按纯对话发送',
    stActDone: '动手完成 ✓',
    stWebOn: '已开启联网 — 下次提问可上网查证',
    stWebOff: '已关闭联网',
    stNotConnectedReopen: '未连接,请重开侧边栏或重跑 install.cmd',
    stNotConnected: '未连接',
    stBusySwitch: '正在进行中,先点 ■ 停止再切换',
    stWriteInstr: '先写下你要它做什么',
    stSetDirFirst: '请先设置工作目录',
    stPlanning: '正在拟定计划…',
    stExecuting: '执行中…(只在工作目录内动文件)',
    stTaskCancelled: '已取消该任务',
    stError: '出错',
    // thrown errors
    errNoActiveTab: '没有活动标签页',
    errCantRead: '此页面无法读取内容',
    // act plan / tools
    actPlanHead: (dir) => '📋 执行计划 · 请审阅(只在 ' + dir + ' 内动文件,不跑命令)',
    approveGo: '✅ 批准执行', approveNo: '✋ 取消',
    noPlan: '(未给出计划)', execed: '(已执行)', execedPrefix: '🛠 已执行:',
    verbWrite: '写入', verbEdit: '编辑', verbRead: '读取', verbGlob: '查找', verbGrep: '搜索',
    // working dir
    dirUnset: '(未设置)',
    chooseDirPrompt: '设置工作目录(绝对路径)。Claude 只能在此目录内读写文件,不会执行任何命令:',
    // user message labels
    multitabMsg: (n) => '多页对比 · ' + n + ' 个网页',
    actMsgPrefix: '🛠 ',
    selAskLabel: (s) => '选中提问 · ' + s,
    // options page
    optTitle: '旁注 · 设置',
    optSaved: '已保存 ✓',
    optActHead: '放权动手',
    optWorkDir: '工作目录',
    optWorkDirPh: '例如 C:\\Users\\你\\PageTalk\\workspace',
    optWorkDirHint: 'Claude 在「放权动手」时只能在此目录内读写文件,不会执行命令、不会越界。留空则用默认目录。',
    optChatHead: '对话',
    optDefLang: '默认界面与回答语言',
    optDefLangHint: '侧边栏右上角仍可随时临时切换。',
    optWebDefault: '默认开启联网搜索',
    optWebDefaultHint: '开启后每次打开侧边栏都让 Claude 可上网查证(较慢,走你的订阅)。',
    optFoot: '设置即时生效并自动保存;已打开的侧边栏会自动同步。',
  },
  'EN': {
    // header
    langTitle: 'Switch interface & answer language (中 / EN)',
    settings: 'Settings',
    newChat: 'New chat',
    // context bar
    ctxbarTitle: 'Which page is being read',
    ctxCurrent: 'Current page…',
    lockedTitle: 'Locked: switching tabs won’t affect it. Click to unlock and follow the current page',
    lockedPage: '(Locked page)',
    lockTitle: 'Lock the current page (switching tabs won’t affect it)',
    // quickbar
    chip_summary: 'Summarize', chip_translate: 'Translate', chip_keypoints: 'Key points',
    chip_outline: 'Outline', chip_data: 'Data', chip_factcheck: 'Fact-check',
    multitab: 'Compare pages', multitabTitle: 'Compare several pages open in this window',
    // act bar
    actLabel: 'Act',
    actDirWrapTitle: 'Working directory: it can only read/write files inside this directory, and runs no commands',
    actEdit: 'Edit', actEditTitle: 'Change working directory',
    // empty state
    emptyHtml: 'Use the buttons above to handle this page,<br/>or just ask about it below.',
    // composer
    placeholder: 'Ask about this page…',
    placeholderAct: 'Tell it what to do in the working directory… (it plans first, you approve, then it acts)',
    webOnTitle: 'Web search is on (click to turn off)',
    webOffTitle: 'Web search: let Claude look things up online (slower, on your subscription)',
    actModeTitle: 'Act: let it read/write files in a chosen directory (plan → approve → run)',
    visionOnTitle: 'On: a screenshot of the current screen is attached when sending',
    visionOffTitle: 'Attach screenshot (let it see this screen)',
    send: 'Send', stop: 'Stop',
    // roles / copy
    roleUser: 'You', copy: 'Copy', copied: 'Copied', copyFail: 'Copy failed',
    // status line
    stConnecting: 'Connecting…',
    stConnectFail: (e) => 'Can’t reach the local helper: ' + e,
    stDisconnected: (e) => 'Disconnected' + (e ? ' (' + e + ')' : '') + ' — re-run install.cmd and fully restart Edge',
    stConnected: 'Connected ✓',
    stLockedClosed: 'The locked tab was closed; switched back to the current page',
    stNoTabToLock: 'No tab to lock',
    stReadingTabs: (n) => 'Reading ' + n + ' tabs…',
    stNeed2: 'Fewer than 2 readable pages in this window',
    stNoContent: 'Couldn’t read any usable page content',
    stPlanReady: 'Plan ready — review and approve',
    stActError: (m) => 'Act error: ' + (m || ''),
    stActStopped: 'Act stopped',
    stAnswering: 'Answering…',
    stThinking: 'Thinking… (about 10s the first time)',
    stStopped: 'Stopped',
    stBusyAnswer: 'Answering now — click ■ to stop first',
    stBusyAct: 'Acting now — click ■ to stop first',
    stChatFallback: 'Note: this page couldn’t be read; sent as a plain message',
    stActDone: 'Act done ✓',
    stWebOn: 'Web search on — your next question can search online',
    stWebOff: 'Web search off',
    stNotConnectedReopen: 'Not connected — reopen the sidebar or re-run install.cmd',
    stNotConnected: 'Not connected',
    stBusySwitch: 'In progress — click ■ to stop before switching',
    stWriteInstr: 'First write what you want it to do',
    stSetDirFirst: 'Set a working directory first',
    stPlanning: 'Drafting a plan…',
    stExecuting: 'Running… (only touching files in the working directory)',
    stTaskCancelled: 'Task cancelled',
    stError: 'Error',
    // thrown errors
    errNoActiveTab: 'No active tab',
    errCantRead: 'This page can’t be read',
    // act plan / tools
    actPlanHead: (dir) => '📋 Plan · please review (only edits files in ' + dir + ', runs no commands)',
    approveGo: '✅ Approve & run', approveNo: '✋ Cancel',
    noPlan: '(no plan given)', execed: '(done)', execedPrefix: '🛠 Done: ',
    verbWrite: 'Write', verbEdit: 'Edit', verbRead: 'Read', verbGlob: 'Find', verbGrep: 'Search',
    // working dir
    dirUnset: '(not set)',
    chooseDirPrompt: 'Set the working directory (absolute path). Claude can only read/write files inside it and runs no commands:',
    // user message labels
    multitabMsg: (n) => 'Compare pages · ' + n + ' pages',
    actMsgPrefix: '🛠 ',
    selAskLabel: (s) => 'Ask about selection · ' + s,
    // options page
    optTitle: '旁注 · Settings',
    optSaved: 'Saved ✓',
    optActHead: 'Agent actions',
    optWorkDir: 'Working directory',
    optWorkDirPh: 'e.g. C:\\Users\\you\\PageTalk\\workspace',
    optWorkDirHint: 'In agent mode, Claude can only read/write files inside this directory — it runs no commands and cannot go outside it. Leave blank to use the default.',
    optChatHead: 'Chat',
    optDefLang: 'Default interface & answer language',
    optDefLangHint: 'You can still switch anytime from the top-right of the sidebar.',
    optWebDefault: 'Enable web search by default',
    optWebDefaultHint: 'When on, every time you open the sidebar Claude can search the web (slower, on your subscription).',
    optFoot: 'Changes take effect instantly and save automatically; open sidebars sync on their own.',
  },
};

// 把 [data-i18n*] 钩子套到 DOM 上。root 默认 document。
export function applyDom(root, lang) {
  const d = UI[lang] || UI['中'];
  const val = (k) => { const v = d[k]; return typeof v === 'function' ? v() : v; };
  root.querySelectorAll('[data-i18n]').forEach((el) => { const v = val(el.dataset.i18n); if (v != null) el.textContent = v; });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { const v = val(el.dataset.i18nHtml); if (v != null) el.innerHTML = v; });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { const v = val(el.dataset.i18nTitle); if (v != null) el.title = v; });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { const v = val(el.dataset.i18nPh); if (v != null) el.placeholder = v; });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { const v = val(el.dataset.i18nAria); if (v != null) el.setAttribute('aria-label', v); });
}
