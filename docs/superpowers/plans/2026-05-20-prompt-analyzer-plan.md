# Prompt Analyzer Skill 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个 Claude Code skill，持续收集用户提示词，通过 `/analyze-me` 命令分析用户 AI 技能水平和行为画像。

**Architecture:** Hook 脚本（Node.js）拦截提示词写入本地 JSONL → Skill 文件定义分析流程 → 3 个子代理并行分析 + 主进程安全扫描 → 终端报告 + 可选 HTML。

**Tech Stack:** Node.js（Claude Code 自带运行时）、纯文本 JSONL 存储、单文件 HTML（Chart.js CDN 内联）

---

## 文件结构

```
skills/prompt-analyzer/
├── SKILL.md                    # 主文件：触发规则 + 完整分析流程指令
├── README.md                   # 用户安装说明（中文）
├── scripts/
│   └── log-prompt.js           # Hook 脚本：拦截并记录提示词
├── templates/
│   └── report.html             # HTML 报告模板（内联 CSS + Chart.js）
└── patterns/
    └── security-patterns.json  # 安全扫描正则模式库
```

---

### Task 1: 创建项目目录结构

**Files:**
- Create: `skills/prompt-analyzer/` 目录及其所有子目录

- [ ] **Step 1: 创建所有目录**

```bash
mkdir -p skills/prompt-analyzer/scripts
mkdir -p skills/prompt-analyzer/templates
mkdir -p skills/prompt-analyzer/patterns
```

- [ ] **Step 2: 验证目录结构**

```bash
ls -R skills/prompt-analyzer/
```

预期输出：
```
scripts/  templates/  patterns/
```

---

### Task 2: 实现 Hook 脚本 log-prompt.js

**Files:**
- Create: `skills/prompt-analyzer/scripts/log-prompt.js`

- [ ] **Step 1: 编写 log-prompt.js**

```javascript
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
      const promptText = ctx.prompt || '';

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

      process.exit(0);
    } catch (err) {
      // 静默失败，不影响正常使用
      console.error('[prompt-analyzer] log error:', err.message);
      process.exit(0);
    }
  });

  // stdin 超时保护（2秒）
  setTimeout(() => { process.exit(0); }, 2000);
}

main();
```

- [ ] **Step 2: 验证脚本语法**

```bash
node --check skills/prompt-analyzer/scripts/log-prompt.js
```

预期：无输出，退出码 0

- [ ] **Step 3: 手动测试写入**

```bash
echo '{"prompt":"测试提示词","cwd":"E:\\\\test","session_id":"test-123"}' | node skills/prompt-analyzer/scripts/log-prompt.js
cat ~/.claude/prompt-log/$(date +%Y-%m).jsonl
```

预期：输出一行 JSON，包含 ts/project/session/prompt 四个字段

- [ ] **Step 4: 测试跳过空提示词**

```bash
echo '{"prompt":"","cwd":"","session_id":""}' | node skills/prompt-analyzer/scripts/log-prompt.js
echo "exit code: $?"
```

预期：退出码 0，无新行写入

- [ ] **Step 5: 测试跳过 slash command**

```bash
echo '{"prompt":"/analyze-me","cwd":"","session_id":""}' | node skills/prompt-analyzer/scripts/log-prompt.js
wc -l ~/.claude/prompt-log/$(date +%Y-%m).jsonl
```

预期：行数不变

---

### Task 3: 实现安全扫描模式库 security-patterns.json

**Files:**
- Create: `skills/prompt-analyzer/patterns/security-patterns.json`

- [ ] **Step 1: 编写 security-patterns.json**

```json
{
  "version": "1.0.0",
  "description": "正则模式库，用于扫描提示词中的敏感信息泄露",
  "patterns": [
    {
      "id": "openai-api-key",
      "name": "OpenAI API Key",
      "pattern": "sk-[A-Za-z0-9-_]{20,80}",
      "severity": "high",
      "suggestion": "使用环境变量 OPENAI_API_KEY 替代硬编码"
    },
    {
      "id": "anthropic-api-key",
      "name": "Anthropic API Key",
      "pattern": "sk-ant-[A-Za-z0-9-_]{20,80}",
      "severity": "high",
      "suggestion": "使用环境变量 ANTHROPIC_API_KEY 替代硬编码"
    },
    {
      "id": "github-token",
      "name": "GitHub Personal Access Token",
      "pattern": "ghp_[A-Za-z0-9]{36}",
      "severity": "high",
      "suggestion": "使用 GitHub CLI (gh auth) 或环境变量替代"
    },
    {
      "id": "github-token-classic",
      "name": "GitHub Classic Token",
      "pattern": "gho_[A-Za-z0-9]{36}",
      "severity": "high",
      "suggestion": "使用 GitHub CLI (gh auth) 或环境变量替代"
    },
    {
      "id": "aws-access-key",
      "name": "AWS Access Key ID",
      "pattern": "AKIA[0-9A-Z]{16}",
      "severity": "high",
      "suggestion": "使用 AWS CLI credentials 文件或 IAM Role"
    },
    {
      "id": "aws-secret-key",
      "name": "AWS Secret Access Key",
      "pattern": "(?i)aws.{0,5}secret.{0,10}[A-Za-z0-9/+]{40}",
      "severity": "high",
      "suggestion": "使用 AWS CLI credentials 文件或 IAM Role"
    },
    {
      "id": "jwt-token",
      "name": "JWT Token",
      "pattern": "eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}",
      "severity": "medium",
      "suggestion": "不要在提示词中粘贴 JWT token，使用占位符替代"
    },
    {
      "id": "private-key-header",
      "name": "SSH/RSA 私钥头",
      "pattern": "-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
      "severity": "critical",
      "suggestion": "严禁在提示词中粘贴私钥，使用 ssh-agent 或文件引用"
    },
    {
      "id": "basic-auth-url",
      "name": "URL 中包含用户名密码",
      "pattern": "https?://[^:]+:[^@]+@[^\\s]+",
      "severity": "high",
      "suggestion": "使用环境变量或配置文件存储认证信息"
    },
    {
      "id": "connection-string",
      "name": "数据库连接字符串",
      "pattern": "(mongodb|mysql|postgresql|postgres|sqlserver|redis)://[^:]+:[^@]+@[^\\s]+",
      "severity": "high",
      "suggestion": "使用环境变量 DATABASE_URL 替代硬编码"
    },
    {
      "id": "internal-ip",
      "name": "内网 IP 地址",
      "pattern": "\\b(10\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[01])|192\\.168)\\.\\d{1,3}\\.\\d{1,3}\\b",
      "severity": "low",
      "suggestion": "考虑用占位符替换内网 IP，如 <INTERNAL_IP>"
    },
    {
      "id": "password-assignment",
      "name": "密码赋值语句",
      "pattern": "(?i)(password|passwd|pwd|secret)\\s*[:=]\\s*[\"'][^\"']{4,}[\"']",
      "severity": "medium",
      "suggestion": "不要在提示词中写入明文密码，使用占位符"
    },
    {
      "id": "deepseek-api-key",
      "name": "DeepSeek API Key",
      "pattern": "sk-[A-Za-z0-9]{30,60}",
      "severity": "high",
      "suggestion": "使用环境变量 DEEPSEEK_API_KEY 替代硬编码"
    }
  ],
  "exclude_patterns": [
    {
      "id": "placeholder-skip",
      "pattern": "(your-api-key|your_token|xxx|placeholder|<[A-Z_]+>)",
      "description": "明显是占位符的数据，排除误报"
    }
  ]
}
```

- [ ] **Step 2: 验证 JSON 格式**

```bash
node -e "JSON.parse(require('fs').readFileSync('skills/prompt-analyzer/patterns/security-patterns.json','utf8')); console.log('JSON valid')"
```

预期：输出 `JSON valid`

---

### Task 4: 实现 HTML 报告模板 report.html

**Files:**
- Create: `skills/prompt-analyzer/templates/report.html`

- [ ] **Step 1: 编写 report.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 协作画像分析报告</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  :root {
    --bg: #0f172a;
    --card-bg: #1e293b;
    --text: #e2e8f0;
    --text-secondary: #94a3b8;
    --accent: #38bdf8;
    --accent2: #a78bfa;
    --accent3: #34d399;
    --warning: #fbbf24;
    --danger: #f87171;
    --border: #334155;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 40px 20px;
  }
  .container { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 2rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.25rem; margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
  .subtitle { color: var(--text-secondary); margin-bottom: 2rem; }
  .card {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    border: 1px solid var(--border);
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
  .score-ring {
    width: 120px; height: 120px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 2rem; font-weight: 700; margin: 0 auto 1rem;
  }
  .level-tag {
    display: inline-block; padding: 4px 12px; border-radius: 20px;
    font-size: 0.85rem; font-weight: 600;
  }
  .bar-wrap { margin-bottom: 12px; }
  .bar-label { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem; }
  .bar-track { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .suggestion-card {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px; margin-bottom: 12px;
    border-left: 4px solid var(--accent);
  }
  .suggestion-card h3 { font-size: 1rem; margin-bottom: 0.5rem; color: var(--accent); }
  .security-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .severity-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
  .severity-critical { background: #7f1d1d; color: #fca5a5; }
  .severity-high { background: #78350f; color: #fcd34d; }
  .severity-medium { background: #1e3a5f; color: #93c5fd; }
  .severity-low { background: #1e293b; color: #94a3b8; }
  .chart-wrap { position: relative; height: 300px; margin: 1rem 0; }
  .stat-num { font-size: 2rem; font-weight: 700; }
  .stat-label { color: var(--text-secondary); font-size: 0.85rem; }
  @media (max-width: 640px) {
    .grid, .grid-3 { grid-template-columns: 1fr; }
  }
  #report-data { display: none; }
</style>
</head>
<body>

<div class="container">
  <h1>📊 AI 协作画像分析报告</h1>
  <p class="subtitle" id="report-meta">基于过去 3 个月 · -- 条提示词</p>

  <!-- 技能概览 -->
  <h2>AI 技能水平</h2>
  <div class="grid">
    <div class="card" style="text-align:center;">
      <div class="score-ring" id="skill-ring" style="background: conic-gradient(var(--accent) calc(var(--score) * 1%), #1e293b 0);"></div>
      <div class="level-tag" id="skill-level" style="background: var(--accent); color: #0f172a;">--</div>
    </div>
    <div class="card">
      <div class="chart-wrap"><canvas id="radar-chart"></canvas></div>
    </div>
  </div>

  <!-- 工作偏向 -->
  <h2>工作偏向</h2>
  <div class="grid">
    <div class="card">
      <div class="chart-wrap"><canvas id="lang-chart"></canvas></div>
    </div>
    <div class="card">
      <div class="chart-wrap"><canvas id="task-chart"></canvas></div>
    </div>
  </div>

  <!-- 沟通风格 & 协作模式 -->
  <h2>沟通风格 & 协作模式</h2>
  <div class="grid">
    <div class="card">
      <h3 style="margin-bottom:1rem;">沟通特征</h3>
      <div id="comm-traits"></div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:1rem;">协作特征</h3>
      <div id="collab-traits"></div>
    </div>
  </div>

  <!-- 使用习惯 -->
  <h2>使用习惯</h2>
  <div class="grid-3">
    <div class="card" style="text-align:center;">
      <div class="stat-num" id="stat-total">--</div>
      <div class="stat-label">总提示词数</div>
    </div>
    <div class="card" style="text-align:center;">
      <div class="stat-num" id="stat-avg-len">--</div>
      <div class="stat-label">平均提示词长度</div>
    </div>
    <div class="card" style="text-align:center;">
      <div class="stat-num" id="stat-active">--</div>
      <div class="stat-label">活跃时段</div>
    </div>
  </div>

  <!-- 成长轨迹 -->
  <h2>成长轨迹</h2>
  <div class="card">
    <div class="chart-wrap"><canvas id="growth-chart"></canvas></div>
  </div>

  <!-- 安全评估 -->
  <h2>安全评估</h2>
  <div class="card" id="security-card">
    <div id="security-content"></div>
  </div>

  <!-- 使用建议 -->
  <h2>个性化建议</h2>
  <div id="suggestions"></div>

  <p style="text-align:center; color: var(--text-secondary); margin-top: 3rem; font-size: 0.85rem;">
    Prompt Analyzer · 数据仅存储于本地 · <span id="report-date"></span>
  </p>
</div>

<script>
// ========== 数据注入占位 ==========
// 以下 DATA 对象由 Skill 分析完成后填充
const DATA = {
  meta: { totalPrompts: 0, dateRange: '', months: 0 },
  skill: { score: 0, level: '', details: {} },
  work: { languages: {}, taskTypes: {} },
  communication: { traits: [] },
  collaboration: { traits: [] },
  habits: { totalPrompts: 0, avgLength: 0, activeHours: '' },
  growth: { labels: [], scores: [] },
  security: { total: 0, findings: [] },
  suggestions: []
};

// ========== 渲染函数 ==========
function renderMeta() {
  document.getElementById('report-meta').textContent =
    `基于过去 ${DATA.meta.months} 个月 · ${DATA.meta.totalPrompts} 条提示词`;
  document.getElementById('report-date').textContent =
    `生成时间：${new Date().toLocaleString('zh-CN')}`;
}

function renderSkill() {
  const { score, level } = DATA.skill;
  const ring = document.getElementById('skill-ring');
  ring.style.setProperty('--score', score);
  ring.textContent = score;
  ring.style.color = score >= 70 ? 'var(--accent)' : score >= 40 ? 'var(--warning)' : 'var(--danger)';
  document.getElementById('skill-level').textContent = level;

  // 雷达图
  new Chart(document.getElementById('radar-chart'), {
    type: 'radar',
    data: {
      labels: ['复杂度', '高级功能', '精准度', '工具使用', '迭代能力', '安全意识'],
      datasets: [{
        label: '当前水平',
        data: [
          DATA.skill.details.complexity || 0,
          DATA.skill.details.advanced || 0,
          DATA.skill.details.precision || 0,
          DATA.skill.details.toolUse || 0,
          DATA.skill.details.iteration || 0,
          DATA.skill.details.security || 0
        ],
        backgroundColor: 'rgba(56,189,248,0.2)',
        borderColor: 'rgba(56,189,248,0.8)',
        borderWidth: 2,
        pointBackgroundColor: '#38bdf8'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true, max: 100,
          ticks: { display: false },
          grid: { color: 'rgba(148,163,184,0.15)' },
          angleLines: { color: 'rgba(148,163,184,0.15)' },
          pointLabels: { color: '#94a3b8', font: { size: 12 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderWork() {
  const langs = DATA.work.languages;
  new Chart(document.getElementById('lang-chart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(langs),
      datasets: [{ data: Object.values(langs), backgroundColor: ['#38bdf8','#a78bfa','#34d399','#fbbf24','#f87171','#fb923c','#e879f9'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, font: { size: 12 } } } }
    }
  });

  const tasks = DATA.work.taskTypes;
  new Chart(document.getElementById('task-chart'), {
    type: 'bar',
    data: {
      labels: Object.keys(tasks),
      datasets: [{ data: Object.values(tasks), backgroundColor: ['#38bdf8','#a78bfa','#34d399','#fbbf24','#f87171'], borderRadius: 6 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 12 } } }
      }
    }
  });
}

function renderCommAndCollab() {
  const commDiv = document.getElementById('comm-traits');
  DATA.communication.traits.forEach(t => {
    commDiv.innerHTML += `<div class="bar-wrap">
      <div class="bar-label"><span>${t.label}</span><span>${t.value}</span></div>
      <div class="bar-track"><div class="bar-fill" style="background:var(--accent2);width:${t.pct}%"></div></div>
    </div>`;
  });

  const collabDiv = document.getElementById('collab-traits');
  DATA.collaboration.traits.forEach(t => {
    collabDiv.innerHTML += `<div class="bar-wrap">
      <div class="bar-label"><span>${t.label}</span><span>${t.value}</span></div>
      <div class="bar-track"><div class="bar-fill" style="background:var(--accent3);width:${t.pct}%"></div></div>
    </div>`;
  });
}

function renderHabits() {
  document.getElementById('stat-total').textContent = DATA.habits.totalPrompts;
  document.getElementById('stat-avg-len').textContent = DATA.habits.avgLength + '字';
  document.getElementById('stat-active').textContent = DATA.habits.activeHours;
}

function renderGrowth() {
  new Chart(document.getElementById('growth-chart'), {
    type: 'line',
    data: {
      labels: DATA.growth.labels,
      datasets: [{
        label: '技能评分趋势',
        data: DATA.growth.scores,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56,189,248,0.1)',
        fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#38bdf8'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: '#94a3b8' } },
        y: { min: 0, max: 100, grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

function renderSecurity() {
  const container = document.getElementById('security-content');
  if (DATA.security.findings.length === 0) {
    container.innerHTML = '<p style="color:var(--accent3);">✅ 全量扫描未发现安全风险</p>';
    return;
  }
  container.innerHTML = `<p style="margin-bottom:1rem;">全量扫描 <strong>${DATA.security.total}</strong> 条记录，发现 <strong style="color:var(--danger);">${DATA.security.findings.length}</strong> 次疑似信息泄露：</p>`;
  DATA.security.findings.forEach(f => {
    container.innerHTML += `<div class="security-item">
      <span class="severity-badge severity-${f.severity}">${f.severity}</span>
      <span style="flex:1;"><strong>${f.name}</strong> — ${f.suggestion}</span>
      <span style="color:var(--text-secondary);">${f.count}次</span>
    </div>`;
  });
}

function renderSuggestions() {
  const container = document.getElementById('suggestions');
  DATA.suggestions.forEach((s, i) => {
    container.innerHTML += `<div class="suggestion-card">
      <h3>建议 ${i + 1}: ${s.title}</h3>
      <p style="color:var(--text-secondary);">${s.desc}</p>
    </div>`;
  });
}

// ========== 启动渲染 ==========
renderMeta();
renderSkill();
renderWork();
renderCommAndCollab();
renderHabits();
renderGrowth();
renderSecurity();
renderSuggestions();
</script>
</body>
</html>
```

- [ ] **Step 2: 验证 HTML 基本结构**

```bash
node -e "
const html = require('fs').readFileSync('skills/prompt-analyzer/templates/report.html','utf8');
console.log('HTML size:', html.length, 'bytes');
console.log('Has Chart.js CDN:', html.includes('chart.js'));
console.log('Has all sections:', ['renderMeta','renderSkill','renderWork','renderCommAndCollab','renderHabits','renderGrowth','renderSecurity','renderSuggestions'].every(f => html.includes(f)));
"
```

预期：
```
HTML size: ... bytes
Has Chart.js CDN: true
Has all sections: true
```

---

### Task 5: 编写 SKILL.md 主文件

**Files:**
- Create: `skills/prompt-analyzer/SKILL.md`

- [ ] **Step 1: 编写 SKILL.md**

```markdown
---
name: prompt-analyzer
description: 收集用户的提示词，通过 /analyze-me 分析用户的 AI 技能水平、工作偏向、沟通风格、使用习惯、成长轨迹、协作模式和安全意识，给出个性化使用建议。触发方式：/analyze-me 或 "分析我的提示词" 等类似表达。
---

# Prompt Analyzer

持续收集 Claude Code 用户的提示词，提供 AI 协作能力画像分析。

## 触发规则

当用户执行以下操作之一时，加载本 skill：

1. 输入 `/analyze-me` slash command
2. 说出与以下模式匹配的自然语言（不区分大小写）：
   - "分析我的提示词"
   - "分析我的prompt"
   - "看看我的AI水平"
   - "分析我的使用习惯"
   - "给我一个AI画像"
   - "分析我的AI技能"

## 分析流程

### 1. 历史数据回填检查

首次运行或当 `~/.claude/prompt-log/` 下文件为空时：

- 检测 `~/.claude/projects/` 目录是否存在
- 若存在，统计其中的会话文件数量和大致时间范围
- 询问用户：「发现约 X 条历史会话记录（覆盖过去 N 个月），是否导入用于分析？」
- 若用户同意：
  - 遍历 `~/.claude/projects/<project>/` 下的所有 `.jsonl` 会话文件
  - 提取每行 JSON 中 `role` 为 `user` 的消息的 `content` 字段
  - 构造标准记录格式，以当前时间戳写入当月 JSONL
  - 每条记录中 session 字段使用原会话文件名
  - 避免导入与已有记录完全重复的内容（相同 prompt 文本跳过）
  - 通知用户导入结果：「已导入 Y 条历史提示词」
- 若用户拒绝：跳过，从今天开始积累
- 在 `config.json` 中记录 `{"historicalImportDone": true}` 避免重复询问

### 2. 数据读取

- 数据目录：`~/.claude/prompt-log/`
- 读取所有 `.jsonl` 文件，解析每行 JSON
- 统计总记录数，确定数据起始月份

### 3. 数据量判断

- 若总数 < 50 条：告知用户「当前仅有 N 条记录，分析结果可能不够准确。建议再使用一段时间后分析。是否仍然继续？」
- 若用户确认继续或数据充足，进入抽样阶段

### 4. 抽样策略

- 50 ~ 2000 条：随机抽样 200 条，均匀覆盖各月份
- 超过 2000 条：随机抽样 300 条，近期（最近 3 个月）权重提升至 60%

### 5. 并行子代理分析

同时派发 3 个子代理，每个都接收抽样数据，分别负责不同维度：

#### 子代理 1：技能分析

**接收数据**：prompt 文本 + ts 时间戳

**分析任务**：

对以下每个子维度给出 0-100 的评分，并附简要文字说明（2-3 句）：

- **提示词复杂度**（complexity）：评估是否使用多步骤指令、条件分支、循环逻辑等。简单问答（如"什么是X"）得分低，复杂工程任务（如"帮我设计一个包含A/B/C的系统"）得分高。
- **高级功能使用**（advanced）：是否使用角色设定、思维链（"让我们一步一步思考"）、自我纠错/验证机制、Few-shot 示例等高级提示技巧。
- **提问精准度**（precision）：提示词是否清晰明确，是否需要多次澄清才能理解意图，是否有歧义或自相矛盾。
- **工具使用熟练度**（toolUse）：是否能有效利用 Claude Code 的工具（文件操作、搜索、Git 等），是否理解工具的边界。
- **迭代协作能力**（iteration）：是否能在多轮对话中逐步完善方案，是否会基于上一轮结果调整策略。

**成长分析**：

将数据按时段分组（按月），评估每个时段的技能得分变化趋势。输出：
- 每个月的综合评分（0-100）
- 是否有明显进步、平稳或退步趋势
- 进步最快的阶段和对应的行为变化

**综合输出格式**：

```
【AI 技能水平】综合评分：XX/100

子维度评分：
- 提示词复杂度：XX/100 — 说明...
- 高级功能使用：XX/100 — 说明...
- 提问精准度：XX/100 — 说明...
- 工具使用：XX/100 — 说明...
- 迭代协作：XX/100 — 说明...

【成长轨迹】
| 月份 | 评分 | 趋势 |
|------|------|------|
| 2026-03 | 45 | — |
| 2026-04 | 52 | ↑ |
| 2026-05 | 61 | ↑↑ |

总体趋势：稳步上升。你在近两个月进步明显，主要体现在...
```

#### 子代理 2：行为分析

**接收数据**：prompt 文本 + ts 时间戳 + project 项目路径

**分析任务**：

**工作偏向**：
- 识别提示词涉及的技术栈/编程语言（Python, JavaScript, TypeScript, Go, Rust, Java, Shell 等），统计百分比
- 识别任务类型（调试 bug、新功能开发、代码重构、学习提问、配置/DevOps、数据分析、文档编写等），统计百分比

**使用习惯**：
- 活跃时段分布（上午/下午/晚上/深夜）
- 工作日 vs 周末使用比例
- 平均会话长度（通过 session 字段分组，统计每会话的 prompt 数量）
- 最常使用的项目/目录

**协作模式**：
- 指令型 vs 协作型比例：指令型（单步明确指令，如"帮我把这个函数改成async"），协作型（多轮探讨式，如"你觉得这里应该怎么优化？"）
- 单次解决率：提示词中是否包含多个独立子任务
- 反馈习惯：是否经常对 AI 的输出进行纠正、补充或肯定

**综合输出格式**：

```
【工作偏向】
技术栈占比：
Python 52%、TypeScript 28%、Shell 12%、其他 8%

任务类型：
调试(38%) > 新功能(31%) > 重构(18%) > 学习(13%)

【使用习惯】
- 总提示词：XXX 条
- 平均提示词长度：XX 字
- 最活跃时段：下午 2-5 点
- 工作日占比：XX%
- 平均会话长度：X 轮

【协作模式】
- 指令型 XX% | 协作型 XX%
- 单次解决率：XX%
- 反馈习惯：经常/偶尔/很少 给予反馈
```

#### 子代理 3：风格分析

**接收数据**：prompt 文本

**分析任务**：

- **语言偏好**：中文/英文/混合的比例
- **风格倾向**：简洁（短句、直接）vs 详细（完整上下文、长篇说明）；正式（敬语、完整句式）vs 随意（口语化、缩写）
- **礼貌程度**：是否使用"请"、"谢谢"等礼貌用语
- **上下文提供**：是否主动提供项目背景、文件路径、环境信息等
- **情绪稳定性**：提示词中是否表现出急躁、沮丧或赞赏等情绪

**综合输出格式**：

```
【沟通风格】
- 语言：中文 XX% | 英文 XX%
- 风格：偏简洁/偏详细，偏正式/偏随意
- 礼貌用语使用频率：经常/偶尔/很少
- 上下文提供：充足/一般/偏少
- 情绪特征：稳定/偶尔波动
```

### 6. 安全扫描（主进程执行，不进入子代理）

读取全部 `.jsonl` 文件（不抽样），使用 `patterns/security-patterns.json` 中的正则模式逐条扫描。

**扫描逻辑**：
1. 对每条 prompt，依次匹配所有模式
2. 对每个匹配，检查是否命中 `exclude_patterns`（占位符排除）
3. 统计每种模式命中次数和记录数
4. 汇总为按严重程度排序的列表

**输出格式**：

```
【安全评估】（全量扫描 X 条记录）

✅ 未发现安全风险
— 或 —

⚠️ 发现 N 次疑似信息泄露：

| 严重度 | 类型 | 次数 | 建议 |
|--------|------|------|------|
| CRITICAL | SSH 私钥 | 1 | 严禁在提示词中粘贴私钥 |
| HIGH | API Key | 3 | 使用环境变量替代 |
| MEDIUM | JWT Token | 2 | 使用占位符替代 |
```

### 7. 汇总与建议生成

收集 3 个子代理的结果和安全扫描结果，去重合并，生成使用建议。

**建议生成规则**：
- 技能评分 < 40：建议从基础开始，推荐学习高级提示技巧相关资源
- 高级功能使用 < 30：建议尝试角色设定和思维链
- 指令型占比 > 70%：建议尝试多轮协作方式，给 AI 更多发挥空间
- 平均提示词长度 < 50 字：建议提供更多上下文，提高输出质量
- 单次解决率低：建议将复杂任务拆分为多个小步骤
- 安全有发现：针对性给出修复建议
- 有成长趋势：鼓励继续保持
- 长时间无成长：建议尝试新领域或新用法

**输出格式**：

```
【个性化建议】

1. [标题]：具体可执行的建议内容
2. [标题]：具体可执行的建议内容
...
```

### 8. 输出终端报告

将以上所有结果整合，以清晰的终端格式输出。

### 9. 询问 HTML 报告

报告输出完毕后，询问用户：

> 「是否需要生成 HTML 详细报告？包含图表和可视化仪表盘，可在浏览器中打开查看。」

若用户同意：
- 读取 `templates/report.html`
- 将分析结果数据注入模板中的 `DATA` 对象
- 写入到用户当前项目目录：`./ai-profile-report.html`
- 告知用户：「报告已生成，路径：`./ai-profile-report.html`，双击即可在浏览器中打开」

## 隐私说明

每次加载本 skill 进行分析时，在开始前输出以下提醒：

> 「Prompt Analyzer 将在本地处理你的提示词数据，不会上传到任何外部服务。所有数据存储于 `~/.claude/prompt-log/`，可随时删除。」

## 重要约束

- 子代理必须并行派发（一次调用同时发出 3 个 Agent 调用）
- 安全扫描使用正则匹配，不要用 AI 判断
- 评分要基于数据给出，不要凭空打分
- 建议要具体可操作，不要泛泛而谈
```

- [ ] **Step 2: 验证 SKILL.md 格式**

```bash
node -e "
const md = require('fs').readFileSync('skills/prompt-analyzer/SKILL.md','utf8');
const hasFrontmatter = md.startsWith('---');
const hasAllSections = ['触发规则','分析流程','子代理 1','子代理 2','子代理 3','安全扫描','汇总与建议','隐私说明'].every(s => md.includes(s));
console.log('Has frontmatter:', hasFrontmatter);
console.log('Has all sections:', hasAllSections);
"
```

预期：
```
Has frontmatter: true
Has all sections: true
```

---

### Task 6: 编写 README.md 安装说明

**Files:**
- Create: `skills/prompt-analyzer/README.md`

- [ ] **Step 1: 编写 README.md**

```markdown
# Prompt Analyzer

一个 Claude Code skill，持续收集你的提示词，根据历史数据生成 AI 协作能力画像分析报告。

## 功能

- 自动记录每次提问（本地存储，不上传）
- `/analyze-me` 一键生成分析报告
- 7 大分析维度：AI 技能、工作偏向、沟通风格、使用习惯、成长轨迹、协作模式、安全意识
- 终端概要报告 + 可选 HTML 可视化报告
- 个性化使用建议

## 安装

### 方式一：通过插件市场安装（推荐）

```bash
claude plugins install prompt-analyzer@your-marketplace
```

安装后重启 Claude Code 即可生效。

### 方式二：手动安装

1. 将 `skills/prompt-analyzer/` 目录复制到 `~/.claude/skills/prompt-analyzer/`
2. 在 `~/.claude/settings.json` 中添加 Hook 配置：

```json
{
  "hooks": {
    "user-prompt-submit": [
      {
        "matcher": "",
        "command": "node ~/.claude/skills/prompt-analyzer/scripts/log-prompt.js"
      }
    ]
  }
}
```

3. 重启 Claude Code

### 首次使用

安装后首次运行 `/analyze-me` 时，系统会询问是否导入历史会话数据进行分析。

## 使用

安装后无需任何操作，Skill 会自动记录你的提示词。当你积累了一定量的数据后：

- 输入 `/analyze-me` 或说「分析我的提示词」
- 等待 30-60 秒，获取完整分析报告
- 可选择生成 HTML 可视化报告

## 隐私

- 所有数据存储在 `~/.claude/prompt-log/` 本地目录
- 不会上传任何数据到外部服务
- 可随时删除数据：删除 `~/.claude/prompt-log/` 目录即可
- 可在 `~/.claude/prompt-log/config.json` 中配置排除特定项目

## 卸载

1. 删除 `~/.claude/skills/prompt-analyzer/` 目录
2. 从 `~/.claude/settings.json` 中移除相关 Hook 配置
3. 如需清除数据：`rm -rf ~/.claude/prompt-log/`

## 依赖

- Node.js（Claude Code 自带，无需额外安装）
- 无其他外部依赖
```

- [ ] **Step 2: 验证 README.md 完整性**

```bash
node -e "
const md = require('fs').readFileSync('skills/prompt-analyzer/README.md','utf8');
const sections = ['安装','使用','隐私','卸载'];
const allPresent = sections.every(s => md.includes(s));
console.log('All sections present:', allPresent);
console.log('README size:', md.length, 'bytes');
"
```

预期：
```
All sections present: true
README size: ... bytes
```

---

### Task 7: 集成验证

**Files:** 不创建新文件，验证所有文件完整性和一致性

- [ ] **Step 1: 验证全部文件存在**

```bash
echo "=== 检查文件完整性 ==="
for f in \
  skills/prompt-analyzer/SKILL.md \
  skills/prompt-analyzer/README.md \
  skills/prompt-analyzer/scripts/log-prompt.js \
  skills/prompt-analyzer/templates/report.html \
  skills/prompt-analyzer/patterns/security-patterns.json
do
  if [ -f "$f" ]; then
    echo "✅ $f ($(wc -c < "$f") bytes)"
  else
    echo "❌ $f 不存在"
  fi
done
```

预期：全部 ✅

- [ ] **Step 2: 验证 Hook 脚本功能测试**

```bash
# 清理测试数据
rm -f ~/.claude/prompt-log/$(date +%Y-%m).jsonl

# 测试正常写入
echo '{"prompt":"帮我写一个Python脚本处理CSV文件","cwd":"E:\\\\test","session_id":"sess-001"}' | node skills/prompt-analyzer/scripts/log-prompt.js

# 测试跳过旧版 slash command（注：此 form 已不适用，但检查不崩溃）
echo '{"prompt":"/clear","cwd":"E:\\\\test","session_id":"sess-002"}' | node skills/prompt-analyzer/scripts/log-prompt.js

# 测试跳过空
echo '{"prompt":"","cwd":"E:\\\\test","session_id":"sess-003"}' | node skills/prompt-analyzer/scripts/log-prompt.js

# 验证只有一条记录被写入
echo "写入记录数:"
wc -l < ~/.claude/prompt-log/$(date +%Y-%m).jsonl
```

预期：输出 `写入记录数: 1`

- [ ] **Step 3: 验证安全模式正则有效性**

```bash
node -e "
const patterns = require('./skills/prompt-analyzer/patterns/security-patterns.json');

const testCases = [
  { text: '用这个key: sk-proj-abc123def456ghi789jkl', shouldMatch: ['openai-api-key', 'deepseek-api-key'] },
  { text: 'ANTHROPIC_API_KEY=sk-ant-xxx111yyy222', shouldMatch: ['anthropic-api-key'] },
  { text: '这是示例：sk-your-api-key-here', shouldMatch: [] },  // 应被exclude
  { text: '连接字符串 mongodb://admin:pass123@10.0.0.1:27017', shouldMatch: ['connection-string', 'internal-ip'] },
  { text: '正常的技术讨论，没有敏感信息', shouldMatch: [] },
  { text: '-----BEGIN RSA PRIVATE KEY----- MIIEpAIBAAKCAQEA...', shouldMatch: ['private-key-header'] },
];

let passed = 0;
testCases.forEach((tc, i) => {
  const matched = [];
  patterns.patterns.forEach(p => {
    try {
      const re = new RegExp(p.pattern, 'g');
      if (re.test(tc.text)) {
        // Check exclude
        let excluded = false;
        patterns.exclude_patterns.forEach(ep => {
          if (new RegExp(ep.pattern, 'gi').test(tc.text)) {
            excluded = true;
          }
        });
        if (!excluded) matched.push(p.id);
      }
    } catch(e) { console.log('Regex error:', p.id, e.message); }
  });
  const expected = tc.shouldMatch.sort().join(',');
  const got = matched.sort().join(',');
  if (expected === got) {
    console.log('✅ Test', i+1, ':', tc.text.substring(0,40) + '...');
    passed++;
  } else {
    console.log('❌ Test', i+1, ': expected', expected, 'got', got);
  }
});
console.log(passed + '/' + testCases.length + ' tests passed');
"
```

预期：全部 ✅

- [ ] **Step 4: 验证 HTML 模板关键结构**

```bash
node -e "
const html = require('fs').readFileSync('skills/prompt-analyzer/templates/report.html','utf8');
const checks = {
  'Chart.js CDN': html.includes('chart.js'),
  '雷达图': html.includes('radar-chart'),
  '饼图': html.includes('doughnut'),
  '折线图': html.includes('line'),
  '安全卡片': html.includes('security-card'),
  '建议区域': html.includes('suggestions'),
  'DATA对象': html.includes('const DATA ='),
  'renderMeta': html.includes('renderMeta()'),
  'renderSkill': html.includes('renderSkill()'),
  'renderWork': html.includes('renderWork()'),
  'renderGrowth': html.includes('renderGrowth()'),
  'renderSecurity': html.includes('renderSecurity()'),
  'renderSuggestions': html.includes('renderSuggestions()'),
};
Object.entries(checks).forEach(([k,v]) => console.log(v ? '✅' : '❌', k));
"
```

预期：全部 ✅

---

### Task 8: 提交（如有 Git 仓库）

若项目初始化了 Git 仓库，则提交所有文件。

```bash
git init
git add skills/prompt-analyzer/ docs/
git commit -m "feat: implement prompt-analyzer skill

- Hook script collects user prompts to local JSONL files
- SKILL.md with full analysis flow and subagent orchestration
- Security scanner with regex patterns
- HTML report template with Chart.js visualizations
- Chinese installation guide (README)"
```
