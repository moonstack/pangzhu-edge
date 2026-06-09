'use strict';
const $actDir = document.getElementById('actDir');
const $defaultLang = document.getElementById('defaultLang');
const $defaultWeb = document.getElementById('defaultWeb');
const $saved = document.getElementById('saved');

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
  } catch (_) {}
}

function save(patch) {
  try { chrome.storage.local.set(patch); flashSaved(); } catch (_) {}
}

$actDir.addEventListener('change', () => save({ actDir: $actDir.value.trim() }));
$actDir.addEventListener('blur', () => save({ actDir: $actDir.value.trim() }));
$defaultLang.addEventListener('change', () => save({ defaultLang: $defaultLang.value }));
$defaultWeb.addEventListener('change', () => save({ defaultWeb: $defaultWeb.checked }));

load();
