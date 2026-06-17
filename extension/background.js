// 点扩展图标即打开侧边栏
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error('setPanelBehavior failed', e));

// 右键"问旁注"(选中文字时可用)。标题随界面语言切换。
const MENU_TITLE = { '中': '问旁注:“%s”', 'EN': 'Ask Marginalia: “%s”' };
function menuTitleFor(lang) { return MENU_TITLE[lang === 'EN' ? 'EN' : '中']; }

async function ensureMenu() {
  let lang = '中';
  try { const s = await chrome.storage.local.get('defaultLang'); if (s.defaultLang === 'EN') lang = 'EN'; } catch (_) {}
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'pagetalk-ask', title: menuTitleFor(lang), contexts: ['selection'] });
  });
}

chrome.runtime.onInstalled.addListener(ensureMenu);
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(ensureMenu);

// 语言切了 → 同步更新右键菜单标题
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.defaultLang) {
    const lang = changes.defaultLang.newValue === 'EN' ? 'EN' : '中';
    try { chrome.contextMenus.update('pagetalk-ask', { title: menuTitleFor(lang) }); } catch (_) {}
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'pagetalk-ask' || !info.selectionText) return;
  try {
    await chrome.storage.session.set({ pendingAsk: { text: info.selectionText, ts: Date.now() } });
    if (tab && tab.windowId != null) await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) {
    console.error('pagetalk context menu failed', e);
  }
});

// 快捷键(默认 Ctrl+Shift+S):打开侧边栏并总结当前网页
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'summarize') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.storage.session.set({ pendingAction: { act: 'summary', ts: Date.now() } });
    if (tab && tab.windowId != null) await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) {
    console.error('pagetalk command failed', e);
  }
});
