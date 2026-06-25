# TTFHW Build Verification Dashboard

TTFHW 仓库编译验证结果可视化仪表盘，覆盖多个社区、数十个仓库的编译/单元测试/示例执行验证数据。

## 技术栈

- Next.js 16 (App Router)
- React 18 + TypeScript
- Tailwind CSS + Recharts
- 静态站点生成 (SSG)，部署到 GitHub Pages

## 快速开始

```bash
npm install
npm run dev      # 开发模式 → http://localhost:3000
npm run build    # 生产构建（out/）
npm run start    # 生产运行
```

## Skills 总览

本项目包含 5 个 Claude Code Skill，覆盖从仓库验证到飞书表格刷新的完整链路：

| Skill | 用途 | 触发方式 |
|-------|------|----------|
| `ttfhw-verify-pro` | 验证单个仓库（构建/UT/样例） | "验证XXX仓库" |
| `ttfhw-report-normalizer` | 原始 JSON → 归一化 JSON | `/ttfhw-report-normalizer` |
| `ttfhw-feishu-update` | 归一化数据 → 飞书表格 | `/ttfhw-feishu-update` |
| `ttfhw-pipeline` | 单仓库端到端全流程 | "完整验证XXX仓库" |
| `ttfhw-sync-deploy` | 拉取远端 → 归一化 → 构建 → 推送双端 | "同步并部署" |

---

## 一、Skill 详解

### 1. ttfhw-verify-pro — 仓库验证

模拟外部新手开发者，从 README 出发，在容器中完成构建/单元测试/样例执行验证。

**核心约束**：
- 只看文档，不猜测
- 缺少依赖必须先尝试安装，不得直接失败
- 不改源码
- 记录每一步耗时

**触发**: "验证XXX仓库"、"跑ttfhw验证"、"verify repo"

**输出**: `json-org-630/verification_report_WSL_<repo>_<YYYYMMDD>.json`

---

### 2. ttfhw-report-normalizer — JSON 归一化

将 `json-org-630/` 中的原始验证报告转换为统一模板结构，放入 `json/`。

**两种模式**：

**全量比对**（不带参数）：
```
/ttfhw-report-normalizer
```
对比 `json-org-630/` 和 `json/` 两个目录，通过仓库标识匹配自动识别新增文件，并行启动多个 Agent 逐个归一化，最后清理 `.next` 并重新构建。

**指定文件**（带文件名参数）：
```
/ttfhw-report-normalizer verification_report_WSL_xxx_20260620.json
```
仅对 `json-org-630/` 下指定的一个文件进行归一化。

**核心功能**：
- 检测源格式（legacy / stratovirt / shmem / manifest / kutacc）
- 归一化状态值为 5 种标准值：`success` / `partial_success` / `failed` / `not_run` / `no_tests`
- 保留 v630 新增字段（`static_analysis` / `devcontainer` / `duration_breakdown`）
- 脱敏处理（用户名→`<user>`，主机名→`<hostid>`，容器ID→`<container-id>`）
- 输出 9 个顶级键的完整模板结构

**输出**: `json/verification_report_WSL_<repo>_<YYYYMMDD>.json`

---

### 3. ttfhw-feishu-update — 飞书表格刷新

从 `json/` 归一化数据提取 17 列核心指标，批量写入飞书电子表格。

```
/ttfhw-feishu-update
```

**写入的 17 列（F-V）**：

| 列 | 内容 | 列 | 内容 |
|----|------|----|------|
| F | 验证结果（综合判断） | L | 构建状态 |
| G | 总时长 | M | 构建失败原因 |
| H | 环境准备时长 | N | 测试状态 |
| I | 构建时长 | O | 测试失败原因 |
| J | 测试时长 | P | 样例执行状态 |
| K | 样例时长 | Q | 样例失败原因 |
| R | pre-commit 配置 | T | devcontainer 配置 |
| S | pre-commit 结果 | U | devcontainer 结果 |
| V | 验证问题摘要 |

**前置条件**：
- `lark-cli config init --new`（应用配置）
- `lark-cli auth login --scope "sheets:spreadsheet:write_only"`（用户扫码授权）
- 飞书应用后台开通 `sheets:spreadsheet` + `sheets:spreadsheet:write_only` 权限

**表格**: `https://vcnpr8ydwid3.feishu.cn/sheets/ZP68slCR4hWamttGwIDc08GsnZf?sheet=m66BDJ`

---

### 4. ttfhw-pipeline — 单仓库端到端验证

串联 verify → normalize → build → push 的完整流程。

**触发**: "完整验证XXX仓库"、"跑一遍XXX的验证流水线"、"verify and deploy XXX"

**流程**：
1. 调用 `ttfhw-verify-pro` 在容器中验证仓库
2. 调用 `ttfhw-report-normalizer` 归一化生成的 JSON
3. 重新构建静态页面（`npm run build`）
4. 将 `docs/` 推送到 GitHub Pages（`git push github v6`）

---

### 5. ttfhw-sync-deploy — 同步远端并部署

从 GitCode 拉取最新代码，归一化新增报告，构建并推送到 GitHub Pages。

**触发**: "同步并部署"、"拉取最新代码并部署"、"sync and deploy"

**流程**：
1. `git pull origin main` 拉取 GitCode 最新代码
2. 合并到当前分支
3. 对比 `json-org-630/` 和 `json/` 识别新增文件
4. 归一化新增报告到 `json/`
5. 重新构建静态页面
6. Push 到 GitCode 和 GitHub 双端
7. 验证 GitHub Pages 部署状态

---

## 二、端到端完整工作流

```
┌──────────────────────────────────────────────────────────────────┐
│  1. ttfhw-verify-pro                                              │
│  验证目标仓库 → 生成原始 JSON                                      │
│  输出: json-org-630/verification_report_WSL_<repo>_<YYYYMMDD>.json│
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. ttfhw-report-normalizer                                       │
│  读取原始 JSON → 语义理解 → 格式检测 → 状态归一化 → 写入 json/     │
│  5 种标准状态: success / partial_success / failed / not_run /     │
│               no_tests                                            │
│  输出: json/verification_report_WSL_<repo>_<YYYYMMDD>.json        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. Next.js 构建 + GitHub Pages 部署                               │
│  npm run build → out/ → docs/ → git push github v6                │
│  输出: 60+ 静态 HTML 页面                                          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. ttfhw-feishu-update                                           │
│  读取 json/ 归一化数据 → 匹配表格行 → 批量更新 17 列               │
│  lark-cli sheets +batch-update --as user                          │
│  输出: 飞书表格 F-V 列刷新完成                                      │
└──────────────────────────────────────────────────────────────────┘
```

### 快捷方式

| 场景 | 命令/Skill |
|------|-----------|
| 单个新仓库从验证到部署 | `/ttfhw-pipeline` 或 "完整验证XXX仓库" |
| 批量归一化 json-org-630/ 新增文件 | `/ttfhw-report-normalizer` |
| 从远端同步 + 归一化 + 部署 | `/ttfhw-sync-deploy` 或 "同步并部署" |
| 刷新飞书表格 | `/ttfhw-feishu-update` |

## 数据目录

| 目录 | 用途 | 状态 |
|------|------|------|
| `json-org-630/` | ttfhw-verify-pro 生成的原始 JSON | 原始数据，状态值未标准化 |
| `json/` | 归一化后的 JSON | 状态值已标准化，已脱敏 |
| `docs/` | Next.js 静态导出 | GitHub Pages 部署 |

## 归一化规则

- **不捏造数据**：原始数据缺失的字段标记为 `"unknown"`、`0` 或 `[]`
- **不删除字段**：模板结构的所有字段必须保留
- **状态归一化**：将各种状态字符串统一为 5 种标准值
- **URL 处理**：原始数据没有仓库 URL 时留空 `""`，不填入本地路径
- **仓库名推断**：优先使用原始数据中的 `repo_name`，其次从 `repo_url` 推断

## 项目结构

```
app/              # Next.js 页面 (首页 + 详情页)
components/       # React 组件 (图表/卡片/表格/筛选)
lib/              # 数据加载/类型定义/工具函数
json/             # 归一化后的验证报告数据
json-org-630/     # 原始验证报告数据
docs/             # 静态导出 (GitHub Pages)
.claude/skills/   # 项目共享的 Claude Code skills
```
