import { composeChatPrompt, composeFollowup, composeAction, composeActPlan, composeActExec } from '../shared/compose.mjs';
import { UI, applyDom } from '../shared/i18n.mjs';

const HOST_NAME = 'com.pagetalk.host';

const $status = document.getElementById('status');
const $transcript = document.getElementById('transcript');
const $input = document.getElementById('input');
const $send = document.getElementById('send');
const $newchat = document.getElementById('newchat');
const $lang = document.getElementById('lang');
const $vision = document.getElementById('vision');
const $ctxbar = document.getElementById('ctxbar');
const $ctxtitle = document.getElementById('ctxtitle');
const $lock = document.getElementById('lock');
const $actmode = document.getElementById('actmode');
const $actbar = document.getElementById('actbar');
const $actdir = document.getElementById('actdir');
const $actdirEdit = document.getElementById('actdir-edit');
const $web = document.getElementById('web');
const $settings = document.getElementById('settings');

let port = null;
let connected = false;        // native 端口是否已建立(不依赖 claude 内部 init)
let sessionUrl = null;        // 本会话已注入上下文的页面 url
let assistantEl = null;       // 当前正在流式写入的助手气泡
let assistantText = '';
let thinkEl = null;           // 当前回合的"思考过程"折叠块
let thinkText = '';
let pendingEl = null;         // 等待首字的"打字中"占位
let lockedTabId = null;       // 锁定的标签页 id(null = 跟随当前激活页)
let lockedTitle = '';
let lang = '中';              // 界面与回答语言:'中' / 'EN'
let visionOn = false;         // 是否随消息附带当前屏幕截图
let turnActive = false;       // 当前是否正在生成回答(用于"停止")
let convo = [];               // 对话历史(持久化到 storage.local)
let restoring = false;        // 恢复历史中(避免重复记录)
let actMode = false;          // 放权动手模式(让 Claude 在目录内读写文件)
let actDir = '';              // 工作目录(绝对路径)
let defaultActDir = '';       // host 提供的默认工作目录
let actBusy = false;          // 放权任务进行中(计划/执行)
let act = null;               // 当前放权任务对象(见 startActPlan)
let webOn = false;            // 联网搜索模式(切换会重启聊天进程)

// 文案查表(界面壳)。值为函数时传参调用。
function L(k, ...a) { const v = (UI[lang] || UI['中'])[k]; return typeof v === 'function' ? v(...a) : v; }

// ---- 一键动作的指令文案(发给 Claude 的提示词,不属界面,不随界面语言切)----
function actionInstruction(act, ansLang) {
  const out = ansLang === 'EN' ? '\n\n请用英文输出。' : '\n\n请用中文输出。';
  switch (act) {
    case 'summary':   return '请先判断这个网页的类型(新闻报道 / 学术论文 / 代码仓库 / 产品文档 / 论坛讨论 / 其他),再用最适合该类型的方式总结:论文突出研究方法与结论、代码仓库说明它是做什么的及如何使用、新闻给关键事实要点、讨论区提炼主要观点与共识。给出清晰的分点。' + out;
    case 'translate': return ansLang === 'EN'
      ? '请把这个网页的正文翻译成自然流畅的英文(若原文已是英文,则翻成简体中文),保持原有分段。'
      : '请把这个网页的正文翻译成自然流畅的简体中文(若原文已是中文,则翻成英文),保持原有分段。';
    case 'keypoints': return '请提炼这个网页最重要的 5–8 个要点,每条一句话,分点列出。' + out;
    case 'outline':   return '请为这个网页生成结构化大纲(多级标题),反映内容层次。' + out;
    case 'data':      return '请从这个网页中提取所有关键数据与事实(数字、日期、金额、统计、人名地名机构等),分点列出并标注每条的含义。' + out;
    case 'factcheck': return '请对这个网页的主要事实性主张做核查:逐条列出主张 + 你的判断(可信 / 存疑 / 无法判断)+ 简短理由。注意你没有联网,只能基于常识与正文内在一致性判断,不要编造。' + out;
    default:          return '请处理这个网页。' + out;
  }
}
function langSuffix() { return lang === 'EN' ? '\n\n(Please answer in English.)' : ''; }

// ---- 基础 UI ----
function setStatus(text, cls) {
  $status.textContent = text;
  $status.className = 'status' + (cls ? ' ' + cls : '');
}
function removeEmpty() { const e = document.getElementById('empty'); if (e) e.remove(); }
function scrollToBottom() { $transcript.scrollTop = $transcript.scrollHeight; }

function addMessage(role, text) {
  removeEmpty();
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;
  const r = document.createElement('div');
  r.className = 'role';
  if (role === 'user') { r.dataset.i18n = 'roleUser'; r.textContent = L('roleUser'); }
  else { r.textContent = 'Claude'; }
  const b = document.createElement('div');
  b.className = 'bubble';
  wrap.appendChild(r);
  wrap.appendChild(b);
  $transcript.appendChild(wrap);
  scrollToBottom();
  if (role === 'user') { b.textContent = text; recordHistory('user', text); }
  return b;
}

function addThinking() {
  removeEmpty();
  const d = document.createElement('details');
  d.className = 'think';
  d.open = true;
  const s = document.createElement('summary');
  const body = document.createElement('div');
  body.className = 'think-body';
  d.appendChild(s);
  d.appendChild(body);
  $transcript.appendChild(d);
  scrollToBottom();
  return d;
}

function addTyping() {
  removeEmpty();
  const wrap = document.createElement('div');
  wrap.className = 'msg assistant';
  const b = document.createElement('div');
  b.className = 'bubble';
  b.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  wrap.appendChild(b);
  $transcript.appendChild(wrap);
  scrollToBottom();
  return wrap;
}
function clearTyping() { if (pendingEl) { pendingEl.remove(); pendingEl = null; } }

function addCopyButton(wrap, text) {
  const bar = document.createElement('div');
  bar.className = 'msgbar';
  const btn = document.createElement('button');
  btn.className = 'copybtn';
  btn.type = 'button';
  btn.dataset.i18n = 'copy';
  btn.textContent = L('copy');
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); btn.textContent = L('copied'); }
    catch (_) { btn.textContent = L('copyFail'); }
    setTimeout(() => { btn.textContent = L('copy'); }, 1200);
  });
  bar.appendChild(btn);
  wrap.appendChild(bar);
}

function renderMarkdown(el, md) {
  const html = globalThis.marked.parse(md, { breaks: true });
  el.innerHTML = globalThis.DOMPurify.sanitize(html);
  scrollToBottom();
}
function resetTurnState() { assistantEl = null; assistantText = ''; thinkEl = null; thinkText = ''; }

// ---- 历史持久化 ----
function recordHistory(role, text) {
  if (restoring || !text) return;
  convo.push({ role, text });
  if (convo.length > 100) convo = convo.slice(-100);
  try { chrome.storage.local.set({ convo }); } catch (_) {}
}
async function restoreConvo() {
  try {
    const { convo: saved } = await chrome.storage.local.get('convo');
    if (!Array.isArray(saved) || !saved.length) return;
    restoring = true;
    convo = saved.slice();
    for (const m of saved) {
      if (m.role === 'user') { addMessage('user', m.text); }
      else { const b = addMessage('assistant', ''); renderMarkdown(b, m.text); if (m.text) addCopyButton(b.parentElement, m.text); }
    }
    restoring = false;
  } catch (_) { restoring = false; }
}

// ---- native 连接 ----
function connect() {
  connected = false;
  setStatus(L('stConnecting'));
  let thisPort;
  try {
    thisPort = chrome.runtime.connectNative(HOST_NAME);
  } catch (e) {
    setStatus(L('stConnectFail', String((e && e.message) || e)), 'err');
    return;
  }
  port = thisPort;
  thisPort.onMessage.addListener((m) => { if (port === thisPort) onHostMessage(m); });
  thisPort.onDisconnect.addListener(() => {
    if (port !== thisPort) return;   // 旧连接断开(如停止/新对话切换),忽略
    const err = chrome.runtime.lastError;
    connected = false;
    clearTyping();
    setStatus(L('stDisconnected', err ? err.message : ''), 'err');
  });
  connected = true;
  setStatus(L('stConnected'), 'ok');
}

function onHostMessage(msg) {
  if (msg.type === 'hello' || msg.type === 'ready') {
    if (msg.defaultActDir) {
      defaultActDir = msg.defaultActDir;
      if (!actDir) { actDir = defaultActDir; renderActDir(); }
    }
    return;
  }
  if (msg.type === 'web_state') {
    webOn = !!msg.web;
    $web.classList.toggle('on', webOn);
    $web.title = webOn ? L('webOnTitle') : L('webOffTitle');
    return;
  }
  // ---- 放权动手的事件 ----
  if (msg.type === 'act_thinking') {
    if (!act) return;
    clearTyping();
    if (!act.thinkEl) { act.thinkEl = addThinking(); act.thinkText = ''; }
    act.thinkText += msg.text;
    act.thinkEl.querySelector('.think-body').textContent = act.thinkText;
    scrollToBottom();
    return;
  }
  if (msg.type === 'act_delta') {
    if (!act) return;
    clearTyping();
    if (act.thinkEl) act.thinkEl.open = false;
    if (act.phase === 'plan') {
      if (!act.planEl) { act.planEl = addActPlanCard(); act.planBodyEl = act.planEl.querySelector('.plan-body'); }
      act.planText += msg.text;
      renderMarkdown(act.planBodyEl, act.planText);
    } else {
      if (!act.execEl) { act.execEl = addMessage('assistant', ''); act.execText = ''; }
      act.execText += msg.text;
      renderMarkdown(act.execEl, act.execText);
    }
    return;
  }
  if (msg.type === 'act_plan_done') {
    if (!act) return;
    clearTyping();
    const planText = (msg.text || act.planText || '').trim();
    act.plan = planText;
    if (!act.planEl) { act.planEl = addActPlanCard(); act.planBodyEl = act.planEl.querySelector('.plan-body'); }
    renderMarkdown(act.planBodyEl, planText || L('noPlan'));
    act.thinkEl = null; act.thinkText = '';
    addApproveRow(act);
    setActBusy(false);
    setStatus(L('stPlanReady'), 'ok');
    return;
  }
  if (msg.type === 'act_tool') {
    if (!act) return;
    clearTyping();
    if (!act.toolsEl) act.toolsEl = addActTools();
    addToolLine(act.toolsEl, msg.name, msg.file);
    return;
  }
  if (msg.type === 'act_exec_done') {
    if (!act) return;
    clearTyping();
    const finalText = (msg.text || act.execText || '').trim();
    if (act.execEl) { renderMarkdown(act.execEl, finalText || L('execed')); }
    else { act.execEl = addMessage('assistant', ''); renderMarkdown(act.execEl, finalText || L('execed')); }
    if (finalText) addCopyButton(act.execEl.parentElement, finalText);
    recordHistory('assistant', L('execedPrefix') + (finalText || ''));
    act = null;
    setActBusy(false);
    setStatus(L('stActDone'), 'ok');
    return;
  }
  if (msg.type === 'act_error') {
    clearTyping();
    setStatus(L('stActError', msg.message || ''), 'err');
    setActBusy(false);
    return;
  }
  if (msg.type === 'act_cancelled') {
    clearTyping();
    act = null;
    setActBusy(false);
    setStatus(L('stActStopped'), 'ok');
    return;
  }
  if (msg.type === 'thinking') {
    clearTyping();
    if (!thinkEl) thinkEl = addThinking();
    thinkText += msg.text;
    thinkEl.querySelector('.think-body').textContent = thinkText;
    scrollToBottom();
  } else if (msg.type === 'delta') {
    clearTyping();
    if (!assistantEl) {
      if (thinkEl) thinkEl.open = false;
      assistantEl = addMessage('assistant', '');
      assistantText = '';
      setStatus(L('stAnswering'));
    }
    assistantText += msg.text;
    renderMarkdown(assistantEl, assistantText);
  } else if (msg.type === 'turn_done') {
    clearTyping();
    const finalText = msg.text || assistantText;
    if (assistantEl) {
      renderMarkdown(assistantEl, finalText);
      if (finalText) addCopyButton(assistantEl.parentElement, finalText);
    }
    recordHistory('assistant', finalText);
    resetTurnState();
    setTurnActive(false);
    setStatus(L('stConnected'), 'ok');
  } else if (msg.type === 'error') {
    clearTyping();
    setStatus(msg.message || L('stError'), 'err');
    resetTurnState();
    setTurnActive(false);
  }
}

// ---- 标签页 / 上下文条 ----
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}
async function targetTab() {
  if (lockedTabId != null) {
    try { return await chrome.tabs.get(lockedTabId); }
    catch (_) { lockedTabId = null; lockedTitle = ''; refreshContext(); setStatus(L('stLockedClosed'), 'err'); }
  }
  return await getActiveTab();
}
async function refreshContext() {
  if (lockedTabId != null) {
    $ctxbar.classList.add('locked');
    $lock.textContent = '🔒';
    $lock.title = L('lockedTitle');
    $ctxtitle.textContent = lockedTitle || L('lockedPage');
    return;
  }
  $ctxbar.classList.remove('locked');
  $lock.textContent = '🔓';
  $lock.title = L('lockTitle');
  const tab = await getActiveTab();
  $ctxtitle.textContent = (tab && (tab.title || tab.url)) || L('ctxCurrent');
}
async function onLock() {
  if (lockedTabId != null) {
    lockedTabId = null; lockedTitle = '';
  } else {
    const tab = await getActiveTab();
    if (!tab || !tab.id) { setStatus(L('stNoTabToLock'), 'err'); return; }
    lockedTabId = tab.id; lockedTitle = tab.title || tab.url || '';
  }
  refreshContext();
}

// ---- 页面抓取(穿透 Shadow DOM + 全框架;B站视频附带字幕);供单页/多页复用 ----
async function extractInPage() {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'CANVAS', 'TEMPLATE']);
  const BLOCK = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'TR', 'BLOCKQUOTE', 'PRE']);
  function visible(el) {
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
    const s = window.getComputedStyle(el);
    return !s || (s.display !== 'none' && s.visibility !== 'hidden');
  }
  function deepText(root) {
    const parts = [];
    (function walk(n) {
      if (n.nodeType === 3) { parts.push(n.nodeValue); return; }
      if (n.nodeType === 1) { if (SKIP.has(n.tagName)) return; if (!visible(n)) return; }
      if (n.shadowRoot) walk(n.shadowRoot);          // 穿透 Shadow DOM
      for (const c of n.childNodes) walk(c);
      if (n.nodeType === 1 && BLOCK.has(n.tagName)) parts.push('\n');
    })(root);
    return parts.join('').replace(/[ \t ]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  const pick = document.querySelector('article') || document.querySelector('main') || document.body;
  const light = ((pick && pick.innerText) || '').trim();
  const deep = deepText(document.body);
  let text = deep.length > light.length ? deep : light;
  // Bilibili 视频:改用结构化信息(标题/UP主/简介/标签)+ 字幕,替代通用 DOM 抓取
  // (否则容易抓到 B站跨域桥接 iframe 里的 JS,而非视频内容)
  try {
    if (/bilibili\.com\/video\//.test(location.href)) {
      const st = window.__INITIAL_STATE__ || {};
      const vd = st.videoData || {};
      const parts = [];
      if (vd.title) parts.push('视频标题:' + vd.title);
      if (vd.owner && vd.owner.name) parts.push('UP主:' + vd.owner.name);
      const desc = ((vd.desc && vd.desc !== '-' ? vd.desc : '') || vd.dynamic || '').trim();
      if (desc) parts.push('简介:\n' + desc);
      const tags = (st.tags || []).map((t) => t && (t.tag_name || t.name)).filter(Boolean);
      if (tags.length) parts.push('标签:' + tags.join('、'));
      if (parts.length) text = parts.join('\n\n');   // 用真实视频信息替换通用抓取结果
      // 字幕轨(有则并入;没有则明确说明,避免让模型困惑或编造)
      let subAdded = false;
      if (vd.aid && vd.cid) {
        try {
          const r = await fetch('https://api.bilibili.com/x/player/v2?aid=' + vd.aid + '&cid=' + vd.cid + '&bvid=' + (vd.bvid || ''), { credentials: 'include' });
          const j = await r.json();
          const tracks = (j && j.data && j.data.subtitle && j.data.subtitle.subtitles) || [];
          if (tracks.length && tracks[0].subtitle_url) {
            const su = tracks[0].subtitle_url.indexOf('//') === 0 ? 'https:' + tracks[0].subtitle_url : tracks[0].subtitle_url;
            const sj = await (await fetch(su)).json();
            const lines = (sj.body || []).map((x) => x.content).join('\n').trim();
            if (lines) { text += '\n\n【视频字幕】\n' + lines; subAdded = true; }
          }
        } catch (_) {}
      }
      if (!subAdded) text += '\n\n(说明:此视频没有可获取的字幕轨;若是解说/口播类视频,其讲解内容在音频里、不在网页文本中,无法抓取。以上仅为标题与简介等页面信息。)';
    }
  } catch (_) {}
  // YouTube 视频:标题/频道/简介 + 多策略抓字幕(YouTube 已封死直取,故多路兜底)
  try {
    if (/(^|\.)youtube\.com$/.test(location.hostname) && location.pathname === '/watch') {
      let pr = window.ytInitialPlayerResponse;
      if (!pr) {
        for (const s of document.querySelectorAll('script')) {
          const m = /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s.exec(s.textContent || '');
          if (m) { try { pr = JSON.parse(m[1]); } catch (_) {} if (pr) break; }
        }
      }
      const vd = (pr && pr.videoDetails) || {};
      const parts = [];
      if (vd.title) parts.push('视频标题:' + vd.title);
      if (vd.author) parts.push('频道:' + vd.author);
      const desc = (vd.shortDescription || '').trim();
      if (desc) parts.push('简介:\n' + desc.slice(0, 4000));
      if (parts.length) text = parts.join('\n\n');

      let transcript = '';
      // 策略 1:页面已打开「显示文字记录」面板 → 直接读 DOM
      const segs = document.querySelectorAll('ytd-transcript-segment-renderer');
      if (segs.length) {
        const arr = [];
        segs.forEach((s) => { const t = (s.querySelector('.segment-text') || s).textContent.replace(/\s+/g, ' ').trim(); if (t) arr.push(t); });
        transcript = arr.join('\n');
      }
      // 策略 2:YouTube 内部 get_transcript(登录态下通常可用)
      if (!transcript) {
        try {
          const cfg = window.ytcfg;
          const apiKey = cfg && cfg.get && cfg.get('INNERTUBE_API_KEY');
          const ctx = cfg && cfg.get && cfg.get('INNERTUBE_CONTEXT');
          let params = null;
          (function walk(o, d) { if (!o || d > 40 || params) return; if (typeof o === 'object') { if (o.getTranscriptEndpoint && o.getTranscriptEndpoint.params) { params = o.getTranscriptEndpoint.params; return; } for (const k in o) { try { walk(o[k], d + 1); } catch (_) {} if (params) return; } } })(window.ytInitialData, 0);
          if (apiKey && ctx && params) {
            const r = await fetch('https://www.youtube.com/youtubei/v1/get_transcript?key=' + apiKey, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: ctx, params }) });
            if (r.ok) {
              const j = await r.json();
              const arr = [];
              (function dig(o, d) { if (!o || d > 60) return; if (typeof o === 'object') { if (o.transcriptSegmentRenderer && o.transcriptSegmentRenderer.snippet) { const t = (o.transcriptSegmentRenderer.snippet.runs || []).map((x) => x.text).join(''); if (t) arr.push(t); } for (const k in o) dig(o[k], d + 1); } })(j, 0);
              transcript = arr.join('\n');
            }
          }
        } catch (_) {}
      }
      // 策略 3:timedtext json3(部分情况可用)
      if (!transcript) {
        try {
          const tracks = (pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer && pr.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
          if (tracks.length) {
            const pick = tracks.find((t) => t.kind !== 'asr') || tracks[0];
            const u = pick.baseUrl + (pick.baseUrl.indexOf('fmt=') >= 0 ? '' : '&fmt=json3');
            const j = await (await fetch(u, { credentials: 'include' })).json();
            transcript = (j.events || []).map((ev) => (ev.segs || []).map((s) => s.utf8 || '').join('')).join('\n').replace(/\n{2,}/g, '\n').trim();
          }
        } catch (_) {}
      }

      if (transcript) {
        text += '\n\n【视频字幕/文字记录】\n' + transcript;
      } else {
        const hasTracks = !!(pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer && (pr.captions.playerCaptionsTracklistRenderer.captionTracks || []).length);
        text += hasTracks
          ? '\n\n(说明:此视频有字幕,但 YouTube 限制了程序直接抓取。请在播放器下方点「…更多 → 显示文字记录」打开后,再点一次总结/要点,我就能读到全文。)'
          : '\n\n(说明:此视频没有字幕轨;若是口播/音乐类,讲解内容在音频里、不在网页文本中,无法抓取。)';
      }
    }
  } catch (_) {}
  const selection = ((window.getSelection && window.getSelection().toString()) || '').trim();
  return { title: document.title, url: location.href, text, selection, isTop: window.top === window.self };
}

// 判断某个框架的文字是否其实是脚本/桥接代码(B站等会塞跨域 localStorage 桥接 iframe)
function looksLikeCode(t) {
  if (!t) return false;
  const s = t.slice(0, 4000);
  const cjk = (s.match(/[一-龥]/g) || []).length;
  if (/COLS_GET|COLS_SET|postMessage\(|localStorage\.(get|set|remove)Item|addEventListener\(['"]message/.test(s) && cjk < 20) return true;
  const braces = (s.match(/[{};]/g) || []).length;
  return s.length > 0 && braces / s.length > 0.06;   // 大括号/分号占比过高 → 代码
}

async function extractFromTab(tabId) {
  const results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: extractInPage });
  const frames = (results || []).map((r) => r && r.result).filter(Boolean);
  if (!frames.length) return null;
  const top = frames.find((f) => f.isTop) || frames[0];
  // 默认用顶层框架(绝大多数站点正文都在顶层);仅当顶层正文很短时,才考虑更长的子框架,
  // 且排除看起来像代码/桥接脚本的 iframe。
  let best = top;
  if ((top.text || '').length < 200) {
    for (const f of frames) {
      if (f === top) continue;
      if (!looksLikeCode(f.text) && (f.text || '').length > (best.text || '').length) best = f;
    }
  }
  const sel = (frames.find((f) => f.selection) || {}).selection || '';
  return { title: top.title || '', url: top.url || '', text: best.text || '', selection: sel };
}

async function capturePage() {
  const tab = await targetTab();
  if (!tab || !tab.id) throw new Error(L('errNoActiveTab'));
  let page;
  try { page = await extractFromTab(tab.id); } catch (_) { throw new Error(L('errCantRead')); }
  if (!page) throw new Error(L('errCantRead'));
  return page;
}

// ---- 多标签页对比 ----
async function onMultiTab() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const httpTabs = tabs.filter((t) => t.id && /^https?:/i.test(t.url || ''));
    if (httpTabs.length < 2) { setStatus(L('stNeed2'), 'err'); return; }
    const pick = httpTabs.slice(0, 8);
    setStatus(L('stReadingTabs', pick.length));
    const pages = [];
    for (const t of pick) {
      try { const p = await extractFromTab(t.id); if (p && p.text) pages.push(p); } catch (_) {}
    }
    if (!pages.length) { setStatus(L('stNoContent'), 'err'); return; }
    const per = Math.max(2000, Math.floor(20000 / pages.length));
    let body = '';
    pages.forEach((p, i) => { body += `\n\n===== 网页 ${i + 1}:${p.title || p.url} =====\n网址:${p.url}\n${(p.text || '').slice(0, per)}`; });
    const instr = (lang === 'EN' ? '请用英文' : '请用中文') + '对下面这几个网页做对比与综合:各自要点、共同点、关键差异。';
    addMessage('user', L('multitabMsg', pages.length));
    sessionUrl = null;
    sendTurn(instr + body);
  } catch (e) {
    setStatus(String((e && e.message) || e), 'err');
  }
}

function updateSendButton() {
  const busy = turnActive || actBusy;
  $send.textContent = busy ? '■' : '↑';
  $send.title = busy ? L('stop') : L('send');
  $send.classList.toggle('stop', busy);
}
function setTurnActive(b) { turnActive = b; updateSendButton(); }
function setActBusy(b) { actBusy = b; updateSendButton(); }
function onStop() {
  try { if (port) port.disconnect(); } catch (_) {}   // 断开 = 杀掉当前 claude 进程,真正停止生成
  clearTyping();
  if (assistantEl && assistantText) addCopyButton(assistantEl.parentElement, assistantText);
  resetTurnState();
  setTurnActive(false);
  setStatus(L('stStopped'), 'ok');
  sessionUrl = null;   // 重启了会话,下次需重新注入页面上下文
  connect();
}

function sendTurn(text, image) {
  if (!port || !connected) { setStatus(L('stNotConnectedReopen'), 'err'); return; }
  clearTyping();
  pendingEl = addTyping();
  setStatus(L('stThinking'));
  const m = { type: 'user_turn', text };
  if (image) m.image = image;
  port.postMessage(m);
  setTurnActive(true);
}

async function onAction(actName) {
  if (turnActive) { setStatus(L('stBusyAnswer'), 'err'); return; }
  if (actBusy) { setStatus(L('stBusyAct'), 'err'); return; }
  try {
    const page = await capturePage();
    const image = visionOn ? await captureScreenshot() : null;
    addMessage('user', (image ? '📷 ' : '') + (L('chip_' + actName) || actName) + ' · ' + (page.title || page.url));
    sessionUrl = page.url;
    sendTurn(composeAction(page, actionInstruction(actName, lang)), image);
  } catch (e) {
    setStatus(String((e && e.message) || e), 'err');
  }
}

async function onSend() {
  if (turnActive) { setStatus(L('stBusyAnswer'), 'err'); return; }
  if (actBusy) { setStatus(L('stBusyAct'), 'err'); return; }
  const q = $input.value.trim();
  if (!q) return;
  $input.value = ''; $input.style.height = '';
  try {
    const page = await capturePage();
    const image = visionOn ? await captureScreenshot() : null;
    addMessage('user', (image ? '📷 ' : '') + q);
    let text;
    if (sessionUrl === page.url) {
      text = composeFollowup(q);          // 同页追问:上下文已在会话里
    } else {
      text = composeChatPrompt(page, q);  // 新页(或首问):带上完整上下文
      sessionUrl = page.url;
    }
    sendTurn(text + langSuffix(), image);
  } catch (e) {
    addMessage('user', q);
    sendTurn(composeFollowup(q) + langSuffix());
    setStatus(L('stChatFallback'), 'err');
  }
}

function onNewChat() {
  try { if (port) port.disconnect(); } catch (_) {}
  $transcript.innerHTML = '';
  resetTurnState();
  setTurnActive(false);
  pendingEl = null;
  sessionUrl = null;
  convo = [];
  act = null;
  setActBusy(false);
  try { chrome.storage.local.remove('convo'); } catch (_) {}
  connect();
}

function toggleLang() {
  lang = lang === '中' ? 'EN' : '中';
  $lang.textContent = lang;
  applyI18n();
  try { chrome.storage.local.set({ defaultLang: lang }); } catch (_) {}   // 记住选择 + 同步设置页
}

// 整屏套用当前语言(静态钩子 + 依状态的动态文字)
function applyI18n() {
  document.documentElement.lang = lang === 'EN' ? 'en' : 'zh-CN';
  applyDom(document, lang);
  $web.title = webOn ? L('webOnTitle') : L('webOffTitle');
  $vision.title = visionOn ? L('visionOnTitle') : L('visionOffTitle');
  $actmode.title = L('actModeTitle');
  $input.placeholder = actMode ? L('placeholderAct') : L('placeholder');
  updateSendButton();
  renderActDir();
  refreshContext();
}

// ---- 联网搜索:切换会让 host 重启聊天进程(带/不带 Web 工具)----
function toggleWeb() {
  if (turnActive || actBusy) { setStatus(L('stBusySwitch'), 'err'); return; }
  if (!port || !connected) { setStatus(L('stNotConnected'), 'err'); return; }
  const next = !webOn;
  try { port.postMessage({ type: 'set_web', web: next }); } catch (_) {}
  sessionUrl = null;   // 进程重启,下次提问需重新注入页面上下文
  setStatus(next ? L('stWebOn') : L('stWebOff'), 'ok');
}
function openSettings() {
  try { chrome.runtime.openOptionsPage(); }
  catch (_) { try { window.open(chrome.runtime.getURL('options/options.html')); } catch (e) {} }
}

async function captureScreenshot() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'jpeg', quality: 60 });
    const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(dataUrl || '');
    return m ? { media_type: m[1], data: m[2] } : null;
  } catch (_) { return null; }
}
function toggleVision() {
  visionOn = !visionOn;
  $vision.classList.toggle('on', visionOn);
  $vision.title = visionOn ? L('visionOnTitle') : L('visionOffTitle');
}

// ---- 放权动手:计划 → 批准 → 执行;只在工作目录内、不跑命令 ----
function shortDir(d) {
  if (!d) return L('dirUnset');
  const parts = d.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts.length > 2 ? '…' + (d.includes('\\') ? '\\' : '/') + parts.slice(-2).join(d.includes('\\') ? '\\' : '/') : d;
}
function renderActDir() {
  $actdir.textContent = actDir || L('dirUnset');
  $actdir.title = actDir || '';
}
function toggleActMode() {
  actMode = !actMode;
  $actmode.classList.toggle('on', actMode);
  $actbar.hidden = !actMode;
  $input.placeholder = actMode ? L('placeholderAct') : L('placeholder');
  if (actMode) renderActDir();
}
function chooseActDir() {
  const v = window.prompt(L('chooseDirPrompt'), actDir || defaultActDir || '');
  if (v == null) return;
  const t = v.trim();
  if (!t) return;
  actDir = t;
  try { chrome.storage.local.set({ actDir }); } catch (_) {}
  renderActDir();
}
function addActPlanCard() {
  removeEmpty();
  const card = document.createElement('div');
  card.className = 'actplan';
  const head = document.createElement('div');
  head.className = 'plan-head';
  head.textContent = L('actPlanHead', shortDir(actDir));
  const body = document.createElement('div');
  body.className = 'plan-body';
  card.appendChild(head);
  card.appendChild(body);
  $transcript.appendChild(card);
  scrollToBottom();
  return card;
}
function addActTools() {
  const box = document.createElement('div');
  box.className = 'act-tools';
  $transcript.appendChild(box);
  scrollToBottom();
  return box;
}
const TOOL_VERB_KEY = { Write: 'verbWrite', Edit: 'verbEdit', MultiEdit: 'verbEdit', Read: 'verbRead', Glob: 'verbGlob', Grep: 'verbGrep' };
function addToolLine(box, name, file) {
  const line = document.createElement('div');
  line.className = 'act-tool';
  const vk = TOOL_VERB_KEY[name];
  const verb = vk ? L(vk) : name;
  const icon = (name === 'Write' || name === 'Edit' || name === 'MultiEdit') ? '✏️' : '🔎';
  const tail = file ? (' ' + file.split(/[\\/]/).pop()) : '';
  line.innerHTML = '<span>' + icon + '</span><span class="tn">' + verb + '</span><span>' + (tail || '') + '</span>';
  box.appendChild(line);
  scrollToBottom();
}
function addApproveRow(a) {
  const row = document.createElement('div');
  row.className = 'approve';
  const go = document.createElement('button');
  go.className = 'go'; go.type = 'button'; go.textContent = L('approveGo');
  const no = document.createElement('button');
  no.className = 'no'; no.type = 'button'; no.textContent = L('approveNo');
  go.addEventListener('click', () => { if (act !== a) return; row.remove(); startActExec(a); });
  no.addEventListener('click', () => { if (act !== a) return; row.remove(); act = null; setStatus(L('stTaskCancelled'), 'ok'); });
  row.appendChild(go); row.appendChild(no);
  a.planEl.appendChild(row);
  a.approveRow = row;
  scrollToBottom();
}
async function startActPlan() {
  if (turnActive) { setStatus(L('stBusyAnswer'), 'err'); return; }
  if (actBusy) return;
  if (!port || !connected) { setStatus(L('stNotConnectedReopen'), 'err'); return; }
  const instruction = $input.value.trim();
  if (!instruction) { setStatus(L('stWriteInstr'), 'err'); return; }
  if (!actDir) { setStatus(L('stSetDirFirst'), 'err'); chooseActDir(); return; }
  $input.value = ''; $input.style.height = '';
  let page = null;
  try { page = await capturePage(); } catch (_) {}
  addMessage('user', L('actMsgPrefix') + instruction + (page && page.title ? '  ·  ' + page.title : ''));
  act = { phase: 'plan', instruction, page, dir: actDir, planText: '', plan: '', planEl: null, planBodyEl: null, thinkEl: null, thinkText: '', execEl: null, execText: '', toolsEl: null };
  clearTyping();
  pendingEl = addTyping();
  setActBusy(true);
  setStatus(L('stPlanning'));
  port.postMessage({ type: 'act_plan', text: composeActPlan(page, instruction, actDir), cwd: actDir });
}
function startActExec(a) {
  a.phase = 'exec';
  a.execEl = null; a.execText = ''; a.thinkEl = null; a.thinkText = ''; a.toolsEl = null;
  clearTyping();
  pendingEl = addTyping();
  setActBusy(true);
  setStatus(L('stExecuting'));
  port.postMessage({ type: 'act_exec', text: composeActExec(a.page, a.instruction, a.plan, a.dir), cwd: a.dir });
}
function cancelAct() {
  try { if (port) port.postMessage({ type: 'act_cancel' }); } catch (_) {}
  clearTyping();
  if (act && act.approveRow) act.approveRow.remove();
  if (act && act.execEl && act.execText) addCopyButton(act.execEl.parentElement, act.execText);
  act = null;
  setActBusy(false);
  setStatus(L('stActStopped'), 'ok');
}

// ---- 选中即问(右键菜单 → 通过 storage.session 传到这里)----
let lastAskTs = 0;
let lastActionTs = 0;
function askAboutSelection(selText) {
  const label = L('selAskLabel', selText.length > 40 ? selText.slice(0, 40) + '…' : selText);
  addMessage('user', label);
  const instr = '请基于我从网页选中的这段文字回答或解释(若是问题就回答它,若是陈述就解释要点):\n\n「' + selText.slice(0, 8000) + '」';
  sendTurn(instr + langSuffix());
}
function maybeAsk(pa) {
  if (!pa || !pa.text || (pa.ts || 0) <= lastAskTs) return;
  lastAskTs = pa.ts || 1;
  try { chrome.storage.session.remove('pendingAsk'); } catch (_) {}
  askAboutSelection(pa.text);
}
function maybeAction(pa) {
  if (!pa || !pa.act || (pa.ts || 0) <= lastActionTs) return;
  lastActionTs = pa.ts || 1;
  try { chrome.storage.session.remove('pendingAction'); } catch (_) {}
  onAction(pa.act);
}
async function consumePending() {
  try {
    const got = await chrome.storage.session.get(['pendingAsk', 'pendingAction']);
    maybeAsk(got.pendingAsk);
    maybeAction(got.pendingAction);
  } catch (_) {}
}

// ---- 事件绑定 ----
$send.addEventListener('click', () => {
  if (turnActive) return onStop();
  if (actBusy) return cancelAct();
  if (actMode) return startActPlan();
  onSend();
});
$newchat.addEventListener('click', onNewChat);
$lang.addEventListener('click', toggleLang);
$lock.addEventListener('click', onLock);
$vision.addEventListener('click', toggleVision);
$actmode.addEventListener('click', toggleActMode);
$actdirEdit.addEventListener('click', chooseActDir);
$actdir.addEventListener('click', chooseActDir);
$web.addEventListener('click', toggleWeb);
$settings.addEventListener('click', openSettings);
document.querySelectorAll('#quickbar .chip[data-act]').forEach((c) => {
  c.addEventListener('click', () => onAction(c.dataset.act));
});
const $multitab = document.getElementById('multitab');
if ($multitab) $multitab.addEventListener('click', onMultiTab);
$input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (turnActive || actBusy) return;
    if (actMode) startActPlan(); else onSend();
  }
});
// 输入框随内容自适应高度
function autoGrow() { $input.style.height = 'auto'; $input.style.height = Math.min($input.scrollHeight, window.innerHeight * 0.4) + 'px'; }
$input.addEventListener('input', autoGrow);
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session') {
      if (changes.pendingAsk && changes.pendingAsk.newValue) maybeAsk(changes.pendingAsk.newValue);
      if (changes.pendingAction && changes.pendingAction.newValue) maybeAction(changes.pendingAction.newValue);
      return;
    }
    if (area === 'local') {   // 设置页改了 → 实时同步
      if (changes.actDir) { actDir = changes.actDir.newValue || ''; renderActDir(); }
      if (changes.defaultLang && (changes.defaultLang.newValue === '中' || changes.defaultLang.newValue === 'EN')) {
        lang = changes.defaultLang.newValue; $lang.textContent = lang; applyI18n();
      }
    }
  });
}

// 未锁定时:切标签页 / 标题变化 → 更新上下文条
chrome.tabs.onActivated.addListener(() => { if (lockedTabId == null) refreshContext(); });
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (lockedTabId == null && (info.title || info.status === 'complete')) refreshContext();
  else if (lockedTabId === tabId && info.title) { lockedTitle = info.title; refreshContext(); }
});

async function boot() {
  let defaultWeb = false;
  try {
    const s = await chrome.storage.local.get(['actDir', 'defaultLang', 'defaultWeb']);
    if (s.actDir) actDir = s.actDir;
    if (s.defaultLang === 'EN' || s.defaultLang === '中') { lang = s.defaultLang; $lang.textContent = lang; }
    defaultWeb = !!s.defaultWeb;
  } catch (_) {}
  applyI18n();          // 先按语言把界面套好,再连接(状态文字才是对的语言)
  connect();
  refreshContext();
  if (defaultWeb && port && connected) { try { port.postMessage({ type: 'set_web', web: true }); } catch (_) {} }
  restoreConvo().then(consumePending);
}
boot();
