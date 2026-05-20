#!/usr/bin/env node
/**
 * Prompt Analyzer Hook Script
 * 由 Claude Code user-prompt-submit hook 触发
 * 从 stdin 读取上下文，追加写入当月 JSONL 文件
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), '.claude', 'prompt-log');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getMonthKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function main() {
  // 从 stdin 读取 hook 传入的 JSON
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const ctx = JSON.parse(raw);
      const promptText = typeof ctx.prompt === 'string' ? ctx.prompt : '';

      // 跳过空提示词和 slash commands
      if (!promptText.trim() || promptText.trim().startsWith('/')) {
        process.exit(0);
      }

      const record = {
        ts: new Date().toISOString(),
        project: ctx.cwd || '',
        session: ctx.session_id || '',
        prompt: promptText
      };

      ensureDir(LOG_DIR);
      const filePath = path.join(LOG_DIR, `${getMonthKey(record.ts)}.jsonl`);
      fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');

      clearTimeout(timer);
      process.exit(0);
    } catch (err) {
      // 静默失败，不影响正常使用
      console.error('[prompt-analyzer] log error:', err.message);
      clearTimeout(timer);
      process.exit(0);
    }
  });

  // stdin 超时保护（2秒）
  const timer = setTimeout(() => { process.exit(0); }, 2000);
}

main();
