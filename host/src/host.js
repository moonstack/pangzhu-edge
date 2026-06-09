'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MessageDecoder, encodeMessage } = require('./framing');
const { ClaudeSession } = require('./claude-session');

// 放权动手的默认工作目录(用户可在侧边栏改);浏览器侧拿不到家目录,所以由 host 提供
const DEFAULT_ACT_DIR = path.join(os.homedir(), 'PageTalk', 'workspace');

const LOG_PATH = path.join(__dirname, '..', 'pagetalk-host.log');
function log(msg) {
  try { fs.appendFileSync(LOG_PATH, new Date().toISOString() + ' ' + msg + '\n'); } catch (_) {}
}

function loadConfig() {
  let cfg = {};
  const cfgPath = path.join(__dirname, '..', 'config.json');
  if (fs.existsSync(cfgPath)) {
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (_) {}
  }
  const command = process.env.PAGETALK_CLAUDE_EXE || cfg.claudeExe;
  const args = process.env.PAGETALK_CLAUDE_ARGS ? JSON.parse(process.env.PAGETALK_CLAUDE_ARGS) : undefined;
  const cwd = cfg.cwd || __dirname;
  return { command, args, cwd };
}

function send(obj) {
  process.stdout.write(encodeMessage(obj));
}

// ---- 聊天会话参数:可切到"联网"模式(WebSearch/WebFetch 经实测需同时进 allowedTools 才不被拦)----
const COMMON = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--include-partial-messages', '--verbose'];
function chatArgs(web) {
  const base = [...COMMON, '--strict-mcp-config'];
  if (web) return [...base, '--tools', 'WebSearch WebFetch', '--allowedTools', 'WebSearch WebFetch'];
  return [...base, '--tools', ''];   // 纯只读对话
}

// ---- 放权动手:用独立临时进程,与持久聊天会话隔离 ----
// 计划阶段:只读工具(没有 Write/Edit,写不了);执行阶段:文件工具(无 Bash,跑不了命令)
const ACT_OVERRIDE = process.env.PAGETALK_ACT_ARGS ? JSON.parse(process.env.PAGETALK_ACT_ARGS) : null; // 测试用桩
function actArgs(kind, cwd) {
  if (ACT_OVERRIDE) return ACT_OVERRIDE.slice();
  if (kind === 'plan') return [...COMMON, '--permission-mode', 'acceptEdits', '--add-dir', cwd, '--tools', 'Read Glob Grep'];
  return [...COMMON, '--permission-mode', 'acceptEdits', '--add-dir', cwd, '--tools', 'Write Edit Read Glob Grep'];
}
function safeCwd(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const t = raw.trim();
  if (!path.isAbsolute(t)) return null;        // 必须是绝对路径(防相对路径解析到意外位置)
  const p = path.resolve(t);
  try { fs.mkdirSync(p, { recursive: true }); } catch (_) { return null; }
  return p;
}

function main() {
  log('host start');
  const cfg = loadConfig();
  if (!cfg.command) {
    log('ERROR: no claude command resolved');
    send({ type: 'error', message: '找不到 claude.exe 路径,请重新运行 install.cmd' });
    process.exit(1);
    return;
  }
  log('claudeExe=' + cfg.command + ' cwd=' + cfg.cwd);

  // 聊天会话(可切换联网模式 → 重启进程)。用会话身份判等,避免旧进程退出误杀 host。
  let webOn = false;
  let session = null;
  function wireChat(s) {
    s.on('ready', () => { if (session === s) { log('claude ready (init)'); send({ type: 'ready', defaultActDir: DEFAULT_ACT_DIR }); } });
    s.on('thinking', (t) => { if (session === s) send({ type: 'thinking', text: t }); });
    s.on('delta', (t) => { if (session === s) send({ type: 'delta', text: t }); });
    s.on('turn_done', (r) => { if (session !== s) return; log('turn_done cost=' + r.cost_usd); send({ type: 'turn_done', text: r.text, cost_usd: r.cost_usd }); });
    s.on('error', (e) => { if (session === s) { log('claude error: ' + String((e && e.message) || e)); send({ type: 'error', message: '启动 claude 失败:' + String((e && e.message) || e) }); } });
    s.on('stderr', (d) => log('chat stderr: ' + String(d).replace(/\s+/g, ' ').slice(0, 300)));
    s.on('exit', (code) => { log('chat exit code=' + code); if (session === s) process.exit(0); });
  }
  function startChat() {
    const old = session;
    let s;
    try { s = new ClaudeSession({ command: cfg.command, args: cfg.args || chatArgs(webOn), cwd: cfg.cwd }); }
    catch (e) { log('ERROR spawn: ' + String((e && e.message) || e)); send({ type: 'error', message: String((e && e.message) || e) }); process.exit(1); return; }
    session = s;
    wireChat(s);
    log('chat spawned web=' + webOn);
    if (old) { try { old.close(); } catch (_) {} }
  }
  startChat();
  send({ type: 'hello', defaultActDir: DEFAULT_ACT_DIR });   // 立即告知默认工作目录(不必等 claude init)

  // 放权动手:同一时刻只跑一个临时进程
  let actSession = null;
  function closeAct() { if (actSession) { try { actSession.close(); } catch (_) {} actSession = null; } }
  function runAct(kind, rawCwd, text) {
    const cwd = safeCwd(rawCwd);
    if (!cwd) { send({ type: 'act_error', message: '工作目录无效(必须是绝对路径)' }); return; }
    closeAct();
    log('act ' + kind + ' cwd=' + cwd + ' len=' + (text || '').length);
    let s;
    try { s = new ClaudeSession({ command: cfg.command, args: actArgs(kind, cwd), cwd }); }
    catch (e) { send({ type: 'act_error', message: '启动失败:' + String((e && e.message) || e) }); return; }
    actSession = s;
    s.on('thinking', (t) => { if (actSession === s) send({ type: 'act_thinking', text: t }); });
    s.on('delta', (t) => { if (actSession === s) send({ type: 'act_delta', text: t }); });
    s.on('tool_use', (t) => { if (actSession === s) send({ type: 'act_tool', name: t.name, file: (t.input && (t.input.file_path || t.input.path)) || '' }); });
    s.on('turn_done', (r) => {
      if (actSession !== s) return;
      send({ type: kind === 'plan' ? 'act_plan_done' : 'act_exec_done', text: r.text, cost_usd: r.cost_usd });
      closeAct();
    });
    s.on('error', (e) => { if (actSession === s) { send({ type: 'act_error', message: String((e && e.message) || e) }); closeAct(); } });
    s.on('stderr', (d) => log('act stderr: ' + String(d).replace(/\s+/g, ' ').slice(0, 200)));
    s.on('exit', (code) => { log('act exit code=' + code); if (actSession === s) actSession = null; });
    s.sendTurn(text);
  }

  const decoder = new MessageDecoder();
  process.stdin.on('data', (chunk) => {
    let msgs;
    try { msgs = decoder.push(chunk); } catch (_) { return; }
    for (const msg of msgs) {
      if (msg && msg.type === 'user_turn' && typeof msg.text === 'string') {
        log('user_turn len=' + msg.text.length + (msg.image ? ' +image' : ''));
        session.sendTurn(msg.text, msg.image || null);
      } else if (msg && (msg.type === 'act_plan' || msg.type === 'act_exec') && typeof msg.text === 'string') {
        runAct(msg.type === 'act_plan' ? 'plan' : 'exec', msg.cwd, msg.text);
      } else if (msg && msg.type === 'act_cancel') {
        log('act_cancel'); closeAct(); send({ type: 'act_cancelled' });
      } else if (msg && msg.type === 'set_web') {
        webOn = !!msg.web;
        startChat();                                   // 重启聊天进程,带上/去掉联网工具
        send({ type: 'web_state', web: webOn });
      }
    }
  });
  process.stdin.on('end', () => { log('stdin end'); closeAct(); session.close(); });
}

main();
