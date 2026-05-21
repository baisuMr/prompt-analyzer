# Prompt Analyzer

一个 Claude Code 插件，持续收集你的提示词，根据历史数据生成 AI 协作能力画像分析报告。

## 功能

- 自动记录每次提问（本地存储，不上传）
- `/analyze-me` 一键生成分析报告
- 7+ 分析维度：AI 技能、工作偏向、专业领域、沟通风格、使用习惯、成长轨迹、协作模式、安全意识
- 终端概要报告 + 可选 HTML 可视化报告（支持打印）
- 个性化使用建议 + 30/60/90 天技能提升路线图
- 可配置的项目排除和记录上限

## 安装

### 方式一：Git 克隆（推荐）

```bash
git clone https://github.com/baisuMr/prompt-analyzer.git ~/.claude/skills/prompt-analyzer
```

然后在 `~/.claude/settings.json` 中添加 Hook 配置：

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/prompt-analyzer/scripts/log-prompt.js"
          }
        ]
      }
    ]
  }
}
```

重启 Claude Code 即可生效。

### 方式二：插件安装（即将上线）

待插件市场上线后，可通过以下命令一键安装：

```
/plugin install prompt-analyzer@baisuMr
```

Hook 和 Skill 均自动配置，安装后重启 Claude Code 即可生效。

### 首次使用

安装后首次运行 `/analyze-me` 时，系统会询问是否导入历史会话数据进行分析。

## 使用

安装后无需任何操作，插件会自动记录你的提示词。当你积累了一定量的数据后：

- 输入 `/analyze-me` 或说「分析我的提示词」
- 等待 30-60 秒，获取完整分析报告
- 可选择生成 HTML 可视化报告

## 配置

在 `~/.claude/prompt-log/config.json` 中可配置以下选项（可选，不存在则使用默认值）：

```json
{
  "historicalImportDone": false,
  "excludeProjects": ["*/sensitive/*"],
  "maxRecordsPerMonth": 10000
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `historicalImportDone` | boolean | false | 首次 `/analyze-me` 后自动设为 true |
| `excludeProjects` | string[] | [] | 不记录提示词的项目路径，支持 `*` 通配符 |
| `maxRecordsPerMonth` | number | 10000 | 每月记录上限，超出不记录；设为 0 不限制 |

参考 `config.example.json` 获取完整模板。

## 隐私

- 所有数据存储在 `~/.claude/prompt-log/` 本地目录
- 不会上传任何数据到外部服务
- 可随时删除数据：删除 `~/.claude/prompt-log/` 目录即可
- 可通过 `excludeProjects` 配置排除敏感项目
- HTML 报告通过 CDN 加载 Google Fonts 和 Chart.js，打开报告时浏览器会向 fonts.googleapis.com、fonts.gstatic.com、cdn.jsdelivr.net 发起请求

## 故障排查

**提示词没有被记录？**
- 检查 `~/.claude/settings.json` 中的 Hook 配置是否正确
- 确认 `log-prompt.js` 脚本路径存在且 Node.js 可用
- 检查是否命中了 `excludeProjects` 排除规则

**运行 `/analyze-me` 没有反应？**
- 确保插件已安装（运行 `/plugin` 查看列表）
- 确保 SKILL.md 中的触发规则未被修改

**HTML 报告图表不显示？**
- HTML 报告需要网络连接加载 Chart.js（CDN）
- 检查浏览器控制台是否有 CDN 加载错误
- 可离线使用时自行下载 Chart.js 到本地并修改模板引用路径

## 卸载

**插件安装方式：**
```
/plugin uninstall prompt-analyzer@baisuMr
```

**手动安装方式：**
1. 删除 `~/.claude/skills/prompt-analyzer/` 目录
2. 从 `~/.claude/settings.json` 中移除相关 Hook 配置
3. 如需清除数据：`rm -rf ~/.claude/prompt-log/`

## 依赖

- Node.js（Claude Code 自带，无需额外安装）
- 无其他外部依赖
