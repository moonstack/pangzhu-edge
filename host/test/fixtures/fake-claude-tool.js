'use strict';
// 假 claude(动手版):init 后,每读到一行 user 消息,先回一条 assistant tool_use(Write),
// 再回 result。用于验证 ClaudeSession 能把 tool_use 解析成 'tool_use' 事件。
const readline = require('node:readline');

process.stdout.write(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'fake-tool' }) + '\n');

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  try { JSON.parse(line); } catch { return; }
  process.stdout.write(JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'C:\\ws\\notes.md', content: 'hi' } }] },
  }) + '\n');
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'done', total_cost_usd: 0 }) + '\n');
});
