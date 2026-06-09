'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { ClaudeSession, buildUserMessage } = require('../src/claude-session');

test('buildUserMessage 纯文字:只有一个 text 块', () => {
  const m = buildUserMessage('hi', null);
  assert.strictEqual(m.message.content.length, 1);
  assert.strictEqual(m.message.content[0].type, 'text');
  assert.strictEqual(m.message.content[0].text, 'hi');
});

test('buildUserMessage 带图片:image 在前、text 在后', () => {
  const m = buildUserMessage('看图', { media_type: 'image/jpeg', data: 'AAAA' });
  assert.strictEqual(m.message.content[0].type, 'image');
  assert.strictEqual(m.message.content[0].source.media_type, 'image/jpeg');
  assert.strictEqual(m.message.content[0].source.data, 'AAAA');
  assert.strictEqual(m.message.content[1].type, 'text');
});

test('ClaudeSession 把假 claude 的输出翻译成 ready/delta/turn_done', async () => {
  const fake = path.join(__dirname, 'fixtures', 'fake-claude.js');
  const s = new ClaudeSession({ command: process.execPath, args: [fake] });
  const events = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    s.on('ready', () => events.push('ready'));
    s.on('thinking', (t) => events.push('thinking:' + t));
    s.on('delta', (t) => events.push('delta:' + t));
    s.on('turn_done', (r) => { events.push('done:' + r.text); clearTimeout(timer); resolve(); });
    setTimeout(() => s.sendTurn('hello world'), 100);
  });
  s.close();
  assert.ok(events.includes('ready'), 'should emit ready');
  assert.ok(events.some((e) => e.startsWith('thinking:')), 'should emit thinking');
  assert.ok(events.some((e) => e.startsWith('delta:echo:')), 'should emit delta');
  assert.ok(events.some((e) => e.startsWith('done:echo:')), 'should emit turn_done');
});

test('ClaudeSession 把 assistant 的 tool_use 解析成 tool_use 事件(放权动手)', async () => {
  const fake = path.join(__dirname, 'fixtures', 'fake-claude-tool.js');
  const s = new ClaudeSession({ command: process.execPath, args: [fake] });
  const tools = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    s.on('tool_use', (t) => tools.push(t));
    s.on('turn_done', () => { clearTimeout(timer); resolve(); });
    setTimeout(() => s.sendTurn('do it'), 100);
  });
  s.close();
  assert.strictEqual(tools.length, 1);
  assert.strictEqual(tools[0].name, 'Write');
  assert.strictEqual(tools[0].input.file_path, 'C:\\ws\\notes.md');
});
