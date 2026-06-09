// 点扩展图标即打开侧边栏
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error('setPanelBehavior failed', e));

// 右键"问 PageTalk"(选中文字时可用)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'pagetalk-ask',
      title: '问 PageTalk:“%s”',
      contexts: ['selection'],
    });
  });
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
