#!/usr/bin/env node
/**
 * Prompt Analyzer Hook Script
 * 由 Claude Code user-prompt-submit hook 触发
 * 从 stdin 读取上下文，追加写入当月 JSONL 文件
 *
 * 配置：~/.claude/prompt-log/config.json
 *   - excludeProjects: 排除的项目路径列表（支持 * 通配符）
 *   - maxRecordsPerMonth: 每月记录上限（默认 10000，0 则不限制）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), '.claude', 'prompt-log');
const CONFIG_PATH = path.join(LOG_DIR, 'config.json');

// 默认配置
const DEFAULTS = {
  excludeProjects: [],
  maxRecordsPerMonth: 10000
};

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

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
    }
  } catch (_) { /* 配置损坏时使用默认值 */ }
  return DEFAULTS;
}

function matchProject(cwd, pattern) {
  // 统一为正斜杠，兼容 Windows
  const normalizedCwd = cwd.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  const escaped = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$', 'i').test(normalizedCwd);
}

function countLines(filePath) {
  // 流式统计换行符，避免将整个文件读入内存
  const stat = fs.statSync(filePath);
  if (stat.size === 0) return 0;
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(65536); // 64KB 块
  let count = 0;
  let bytesRead;
  try {
    while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      for (let i = 0; i < bytesRead; i++) {
        if (buf[i] === 10) count++; // '\n'
      }
    }
  } finally {
    fs.closeSync(fd);
  }
  return count;
}

function extractPromptText(ctx) {
  // 字符串类型：直接返回
  if (typeof ctx.prompt === 'string') return ctx.prompt.trim();

  // 数组类型：多模态消息，提取所有 text 块拼接
  if (Array.isArray(ctx.prompt)) {
    const parts = ctx.prompt
      .filter((m) => m && m.type === 'text' && typeof m.text === 'string')
      .map((m) => m.text.trim())
      .filter(Boolean);
    return parts.join('\n');
  }

  return '';
}

function main() {
  let raw = '';
  const timer = setTimeout(() => { process.exit(0); }, 5000); // 5 秒超时

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      // 校验：stdin 必须以 { 开头才可能是 JSON
      if (!raw.trimStart().startsWith('{')) {
        clearTimeout(timer);
        process.exit(0);
      }

      const ctx = JSON.parse(raw);
      const promptText = extractPromptText(ctx);

      // 跳过空提示词和 slash commands
      if (!promptText || promptText.startsWith('/')) {
        clearTimeout(timer);
        process.exit(0);
      }

      // 加载配置，检查项目排除
      const config = loadConfig();
      const cwd = ctx.cwd || '';
      if (config.excludeProjects.some((p) => matchProject(cwd, p))) {
        clearTimeout(timer);
        process.exit(0);
      }

      // 检查当月记录数上限
      const ts = new Date().toISOString();
      const monthKey = getMonthKey(ts);
      const filePath = path.join(LOG_DIR, `${monthKey}.jsonl`);

      if (config.maxRecordsPerMonth > 0 && fs.existsSync(filePath)) {
        if (countLines(filePath) >= config.maxRecordsPerMonth) {
          clearTimeout(timer);
          process.exit(0);
        }
      }

      const record = {
        ts,
        project: cwd,
        session: ctx.session_id || '',
        prompt: promptText
      };

      ensureDir(LOG_DIR);
      fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');

      clearTimeout(timer);
      process.exit(0);
    } catch (err) {
      console.error('[prompt-analyzer] log error:', err.message);
      clearTimeout(timer);
      process.exit(0);
    }
  });
}

main();
