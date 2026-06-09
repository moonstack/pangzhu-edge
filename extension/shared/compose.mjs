export function truncate(text, maxChars = 24000) {
  const s = text || '';
  if (s.length <= maxChars) return { text: s, truncated: false };
  return { text: s.slice(0, maxChars), truncated: true };
}

export function composeSummarizePrompt(page, maxChars = 24000) {
  const { text, truncated } = truncate(page.text || '', maxChars);
  const note = truncated ? '\n\n(注:正文过长,已截断)' : '';
  return `请用中文总结下面这个网页的主要内容,给出清晰的要点。\n\n标题:${page.title || ''}\n网址:${page.url || ''}\n\n正文:\n${text}${note}`;
}

export function composeChatPrompt(page, question, maxChars = 24000) {
  const { text, truncated } = truncate(page.text || '', maxChars);
  const note = truncated ? '\n\n(注:正文过长,已截断)' : '';
  const sel = page.selection ? `\n我选中的部分:\n${page.selection}\n` : '';
  return `我正在看一个网页,请基于它用中文回答我的问题。\n\n标题:${page.title || ''}\n网址:${page.url || ''}\n${sel}\n正文:\n${text}${note}\n\n我的问题:${question}`;
}

// 通用"对当前网页执行某个指令"(总结/翻译/要点/大纲/数据/核查 等)
export function composeAction(page, instruction, maxChars = 24000) {
  const { text, truncated } = truncate(page.text || '', maxChars);
  const note = truncated ? '\n\n(注:正文过长,已截断)' : '';
  return `${instruction}\n\n标题:${page.title || ''}\n网址:${page.url || ''}\n\n正文:\n${text}${note}`;
}

export function composeFollowup(question) {
  return question;
}

// 把当前网页作为"素材"附在放权任务后面(可选)
function materialBlock(page, maxChars) {
  if (!page || !(page.text || page.title)) return '';
  const { text, truncated } = truncate(page.text || '', maxChars);
  const note = truncated ? '\n\n(注:正文过长,已截断)' : '';
  return `\n\n———— 当前网页(可作为素材)————\n标题:${page.title || ''}\n网址:${page.url || ''}\n正文:\n${text}${note}`;
}

// 放权动手 · 计划阶段:只读,产出一份「将做什么」的文本计划,绝不动文件
export function composeActPlan(page, instruction, cwd, maxChars = 16000) {
  return [
    '【放权动手 · 仅计划阶段】',
    `工作目录(只能在此目录内读写):${cwd}`,
    '现在是只读规划:你可以读取/检索该目录内的现有文件来了解情况,但**绝对不要创建或修改任何文件、不要执行任何命令**。',
    '请输出一份清晰的执行计划:① 将创建/修改哪些文件(相对该目录的路径);② 每个文件大致写入什么;③ 是否需要先读取哪些现有文件。只输出计划本身,简洁分点。',
    '',
    `我的任务:${instruction}`,
    materialBlock(page, maxChars),
  ].join('\n');
}

// 放权动手 · 执行阶段:按已批准的计划,只在工作目录内用文件工具完成,禁止 shell
export function composeActExec(page, instruction, plan, cwd, maxChars = 16000) {
  return [
    '【放权动手 · 执行阶段】',
    `工作目录(只能在此目录内读写,禁止越界):${cwd}`,
    '硬性约束:只能使用文件工具(读/写/编辑),**不要执行任何 shell 命令**;所有写入路径都必须在上述工作目录之内。',
    '下面是已经过我批准的计划,请直接按它执行;若计划有小问题可在目录内合理修正,但不要扩大任务范围。完成后用一句话说明你都做了什么。',
    '',
    `任务:${instruction}`,
    '',
    '已批准的计划:',
    plan || '(无)',
    materialBlock(page, maxChars),
  ].join('\n');
}
