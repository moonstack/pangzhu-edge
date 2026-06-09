import test from 'node:test';
import assert from 'node:assert';
import { truncate, composeSummarizePrompt, composeChatPrompt, composeAction, composeActPlan, composeActExec } from './compose.mjs';

test('truncate 超长则标记 truncated', () => {
  assert.deepStrictEqual(truncate('abcdef', 3), { text: 'abc', truncated: true });
});

test('truncate 短文本原样返回', () => {
  assert.deepStrictEqual(truncate('hi', 100), { text: 'hi', truncated: false });
});

test('composeSummarizePrompt 含标题/网址/正文', () => {
  const p = composeSummarizePrompt({ title: 'T', url: 'U', text: 'body' });
  assert.match(p, /标题:T/);
  assert.match(p, /网址:U/);
  assert.match(p, /body/);
});

test('composeChatPrompt 含问题与选中', () => {
  const p = composeChatPrompt({ title: 'T', url: 'U', text: 'body', selection: 'sel' }, 'why?');
  assert.match(p, /我的问题:why\?/);
  assert.match(p, /sel/);
});

test('composeAction 含指令/标题/正文', () => {
  const p = composeAction({ title: 'T', url: 'U', text: 'body' }, '请提炼要点');
  assert.match(p, /请提炼要点/);
  assert.match(p, /标题:T/);
  assert.match(p, /body/);
});

test('composeActPlan 含工作目录、只读约束、任务', () => {
  const p = composeActPlan({ title: 'T', url: 'U', text: 'body' }, '把这页存成 md', 'C:\\ws');
  assert.match(p, /仅计划阶段/);
  assert.match(p, /C:\\ws/);
  assert.match(p, /不要创建或修改任何文件/);
  assert.match(p, /把这页存成 md/);
  assert.match(p, /body/);
});

test('composeActExec 含执行约束、计划、禁止 shell', () => {
  const p = composeActExec({ title: 'T', url: 'U', text: 'body' }, '把这页存成 md', '步骤一', 'C:\\ws');
  assert.match(p, /执行阶段/);
  assert.match(p, /不要执行任何 shell 命令/);
  assert.match(p, /步骤一/);
  assert.match(p, /C:\\ws/);
});

test('composeActPlan 无网页素材也能用', () => {
  const p = composeActPlan(null, '建个 README', 'C:\\ws');
  assert.match(p, /建个 README/);
  assert.doesNotMatch(p, /当前网页/);
});
