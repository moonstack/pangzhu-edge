'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { encodeMessage, MessageDecoder } = require('../src/framing');

test('host 通过假 claude 转发一轮 user_turn,并把回应帧回来', async () => {
  const hostJs = path.join(__dirname, '..', 'src', 'host.js');
  const fake = path.join(__dirname, 'fixtures', 'fake-claude.js');
  const proc = spawn(process.execPath, [hostJs], {
    env: {
      ...process.env,
      PAGETALK_CLAUDE_EXE: process.execPath,
      PAGETALK_CLAUDE_ARGS: JSON.stringify([fake]),
    },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const dec = new MessageDecoder();
  const got = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    proc.stdout.on('data', (c) => {
      for (const m of dec.push(c)) {
        got.push(m);
        if (m.type === 'turn_done') { clearTimeout(timer); resolve(); }
      }
    });
    setTimeout(() => proc.stdin.write(encodeMessage({ type: 'user_turn', text: 'hello world' })), 200);
  });
  // 优雅收尾:关掉 host 的 stdin,host 会因此关闭 claude 会话(顺带回收 fake-claude 子进程)并自行退出,
  // 避免遗留孤儿进程拖住 `node --test` 整目录运行时的退出。
  proc.stdin.end();
  assert.ok(got.some((m) => m.type === 'ready'), 'should frame ready');
  assert.ok(got.some((m) => m.type === 'delta'), 'should frame delta');
  assert.ok(got.some((m) => m.type === 'turn_done'), 'should frame turn_done');
});

test('host 放权动手:act_exec → 转发 act_tool 与 act_exec_done', async () => {
  const hostJs = path.join(__dirname, '..', 'src', 'host.js');
  const fake = path.join(__dirname, 'fixtures', 'fake-claude.js');
  const fakeTool = path.join(__dirname, 'fixtures', 'fake-claude-tool.js');
  const proc = spawn(process.execPath, [hostJs], {
    env: {
      ...process.env,
      PAGETALK_CLAUDE_EXE: process.execPath,
      PAGETALK_CLAUDE_ARGS: JSON.stringify([fake]),
      PAGETALK_ACT_ARGS: JSON.stringify([fakeTool]),   // 让放权进程也用假 claude
    },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const dec = new MessageDecoder();
  const got = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    proc.stdout.on('data', (c) => {
      for (const m of dec.push(c)) {
        got.push(m);
        if (m.type === 'act_exec_done') { clearTimeout(timer); resolve(); }
      }
    });
    setTimeout(() => proc.stdin.write(encodeMessage({ type: 'act_exec', text: '把这页存成 md', cwd: path.join(__dirname, 'fixtures') })), 200);
  });
  proc.stdin.end();
  const tool = got.find((m) => m.type === 'act_tool');
  assert.ok(tool, 'should frame act_tool');
  assert.strictEqual(tool.name, 'Write');
  assert.ok(tool.file.includes('notes.md'), 'tool_use 应带文件名');
  assert.ok(got.some((m) => m.type === 'act_exec_done'), 'should frame act_exec_done');
});

test('host 联网开关:set_web → 回 web_state 且能继续对话(进程已重启)', async () => {
  const hostJs = path.join(__dirname, '..', 'src', 'host.js');
  const fake = path.join(__dirname, 'fixtures', 'fake-claude.js');
  const proc = spawn(process.execPath, [hostJs], {
    env: { ...process.env, PAGETALK_CLAUDE_EXE: process.execPath, PAGETALK_CLAUDE_ARGS: JSON.stringify([fake]) },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const dec = new MessageDecoder();
  const got = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 6000);
    proc.stdout.on('data', (c) => {
      for (const m of dec.push(c)) {
        got.push(m);
        if (m.type === 'web_state') setTimeout(() => proc.stdin.write(encodeMessage({ type: 'user_turn', text: 'after web' })), 50);
        if (m.type === 'turn_done') { clearTimeout(timer); resolve(); }
      }
    });
    setTimeout(() => proc.stdin.write(encodeMessage({ type: 'set_web', web: true })), 200);
  });
  proc.stdin.end();
  const ws = got.find((m) => m.type === 'web_state');
  assert.ok(ws && ws.web === true, 'should frame web_state web=true');
  assert.ok(got.some((m) => m.type === 'turn_done'), '重启后仍能完成一轮对话');
});

test('host 放权动手:工作目录非绝对路径 → act_error', async () => {
  const hostJs = path.join(__dirname, '..', 'src', 'host.js');
  const fake = path.join(__dirname, 'fixtures', 'fake-claude.js');
  const proc = spawn(process.execPath, [hostJs], {
    env: { ...process.env, PAGETALK_CLAUDE_EXE: process.execPath, PAGETALK_CLAUDE_ARGS: JSON.stringify([fake]) },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const dec = new MessageDecoder();
  let errored = false;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    proc.stdout.on('data', (c) => {
      for (const m of dec.push(c)) {
        if (m.type === 'act_error') { errored = true; clearTimeout(timer); resolve(); }
      }
    });
    setTimeout(() => proc.stdin.write(encodeMessage({ type: 'act_plan', text: 'x', cwd: 'relative/dir' })), 200);
  });
  proc.stdin.end();
  assert.ok(errored, '非绝对路径应回 act_error');
});
