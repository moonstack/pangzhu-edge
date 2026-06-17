import { applyDom } from '../shared/i18n.mjs';

const $actDir = document.getElementById('actDir');
const $defaultLang = document.getElementById('defaultLang');
const $defaultWeb = document.getElementById('defaultWeb');
const $saved = document.getElementById('saved');

function applyLang(l) {
  const lang = (l === 'EN') ? 'EN' : '中';
  document.documentElement.lang = lang === 'EN' ? 'en' : 'zh-CN';
  applyDom(document, lang);
}

let savedTimer = null;
function flashSaved() {
  $saved.hidden = false;
  $saved.style.opacity = '1';
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { $saved.style.opacity = '0'; }, 1200);
}

async function load() {
  try {
    const s = await chrome.storage.local.get(['actDir', 'defaultLang', 'defaultWeb']);
    if (s.actDir) $actDir.value = s.actDir;
    $defaultLang.value = (s.defaultLang === 'EN') ? 'EN' : '中';
    $defaultWeb.checked = !!s.defaultWeb;
    applyLang($defaultLang.value);
  } catch (_) { applyLang('中'); }
}

function save(patch) {
  try { chrome.storage.local.set(patch); flashSaved(); } catch (_) {}
}

$actDir.addEventListener('change', () => save({ actDir: $actDir.value.trim() }));
$actDir.addEventListener('blur', () => save({ actDir: $actDir.value.trim() }));
$defaultLang.addEventListener('change', () => { save({ defaultLang: $defaultLang.value }); applyLang($defaultLang.value); });
$defaultWeb.addEventListener('change', () => save({ defaultWeb: $defaultWeb.checked }));

// 侧边栏切了语言 → 设置页若开着,实时跟随
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.defaultLang && (changes.defaultLang.newValue === '中' || changes.defaultLang.newValue === 'EN')) {
      $defaultLang.value = changes.defaultLang.newValue;
      applyLang(changes.defaultLang.newValue);
    }
    if (changes.actDir && document.activeElement !== $actDir) {
      $actDir.value = changes.actDir.newValue || '';
    }
  });
}

load();
