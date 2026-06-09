'use strict';
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const readline = require('node:readline');

const DEFAULT_ARGS = [
  '-p',
  '--input-format', 'stream-json',
  '--output-format', 'stream-json',
  '--include-partial-messages',
  '--verbose',
  '--tools', '',
  '--strict-mcp-config',
];

// 构造一条 user 消息;image = { media_type, data(base64) } 可选(用于"看图")
function buildUserMessage(text, image) {
  const content = [];
  if (image && image.data) {
    content.push({ type: 'image', source: { type: 'base64', media_type: image.media_type || 'image/png', data: image.data } });
  }
  content.push({ type: 'text', text: text || '' });
  return { type: 'user', message: { role: 'user', content } };
}

class ClaudeSession extends EventEmitter {
  // opts: { command, args, cwd }
  constructor(opts = {}) {
    super();
    const command = opts.command;
    if (!command) throw new Error('ClaudeSession: command (claude.exe path) is required');
    const args = opts.args || DEFAULT_ARGS;
    this.proc = spawn(command, args, {
      cwd: opts.cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });
    this.proc.on('error', (err) => this.emit('error', err));
    this.proc.stderr.on('data', (d) => this.emit('stderr', d.toString()));
    this.proc.on('exit', (code) => this.emit('exit', code));

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => this._onLine(line));
  }

  _onLine(line) {
    if (!line.trim()) return;
    let evt;
    try { evt = JSON.parse(line); } catch { return; }
    if (evt.type === 'system' && evt.subtype === 'init') {
      this.emit('ready');
    } else if (
      evt.type === 'stream_event' &&
      evt.event && evt.event.type === 'content_block_delta' &&
      evt.event.delta && evt.event.delta.type === 'thinking_delta'
    ) {
      this.emit('thinking', evt.event.delta.thinking || '');
    } else if (
      evt.type === 'stream_event' &&
      evt.event && evt.event.type === 'content_block_delta' &&
      evt.event.delta && evt.event.delta.type === 'text_delta'
    ) {
      this.emit('delta', evt.event.delta.text);
    } else if (evt.type === 'assistant' && evt.message && Array.isArray(evt.message.content)) {
      for (const b of evt.message.content) {
        if (b && b.type === 'tool_use') this.emit('tool_use', { name: b.name, input: b.input || {} });
      }
    } else if (evt.type === 'result') {
      this.emit('turn_done', {
        text: evt.result || '',
        cost_usd: typeof evt.total_cost_usd === 'number' ? evt.total_cost_usd : null,
        isError: !!evt.is_error,
      });
    }
  }

  sendTurn(text, image) {
    this.proc.stdin.write(JSON.stringify(buildUserMessage(text, image)) + '\n');
  }

  close() {
    try { this.proc.stdin.end(); } catch (_) {}
    try { this.proc.kill(); } catch (_) {}
  }
}

module.exports = { ClaudeSession, DEFAULT_ARGS, buildUserMessage };
