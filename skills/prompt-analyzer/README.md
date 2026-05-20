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
