'use strict';
// 假 claude:先吐 init,然后每读到一行 user 消息,回一条 delta + 一条 result。
const readline = require('node:readline');

process.stdout.write(JSON.stringify({ type: 'system', subtype: 'init', mcp_servers: [], session_id: 'fake' }) + '\n');

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const inText = (msg && msg.message && msg.message.content && msg.message.content[0] && msg.message.content[0].text) || '';
  const reply = 'echo:' + inText.slice(0, 10);
  process.stdout.write(JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'pondering' } } }) + '\n');
  process.stdout.write(JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: reply } } }) + '\n');
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: reply, total_cost_usd: 0 }) + '\n');
});
