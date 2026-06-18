# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (Next.js Turbopack)
npm run build        # Production build (SSG, static export to out/)
npm run start        # Serve production build
npm run lint         # ESLint
```

## Architecture

Static Next.js 16 App Router dashboard that renders build verification reports from local JSON files. No API routes, no database, no authentication — purely a read-only SSG site.

**Data flow:** `json/*.json` → `lib/data-loader.ts` (server-side) → React components (client-side).

**Dual JSON format handling:** The JSON files come in two formats. The older "report-511" format (with `metadata`, `final_results`, `execution_log` top-level keys) gets converted to a standard format (with `meta`, `build_result`, `ut_stats`, `attempt_log`) by `convertReport511Format()` in `data-loader.ts`. The normalized format is what all components consume.

**Routes:**
- `/` — homepage with stats overview, pie chart, bar chart, filterable repo table
- `/[repo]` — per-repo detail page with build/UT/environment info and full raw JSON dump
- `/_not-found` — required by Next.js 16

**Repo naming:** JSON filenames like `verification_report_WSL_AMCT_20260510.json` are parsed by stripping the prefix and date suffix to derive the route segment (`WSL_AMCT`). `getAllRepoNames()` in `data-loader.ts` handles this. Repo metadata (display name, community, URL) is resolved via `deriveRepoIdentity()` in `utils.ts`, backed by `lib/repo-communities.yaml`.

**Components split:**
- `summary/` — homepage widgets (StatsOverview, FilterBar, RepoTable)
- `detail/` — per-repo page widgets (InfoCards, BuildCard, TestCard, TimelineCard)
- `charts/` — Recharts wrappers (ResultPieChart, DurationBarChart)
- `ui/` — reusable primitives (Card, Badge, StatCard)

**Static export:** `next.config.js` configures `output: 'export'` with `basePath: '/ttfhw-report'` for GitHub Pages deployment. Build output goes to `out/`, then renamed to `docs/` for GitHub Pages serving.

## Key patterns

- **Next.js 16 params:** Route params are `Promise<T>`. Page components that use `params` must be `async` and call `await params`. See `app/[repo]/page.tsx`.
- **Duration estimation:** When `final_results` lacks explicit durations, helper functions fall back to estimating from `execution_log` timestamps and keyword matching on step/command strings.
- **Status normalization:** All status strings go through `normalizeStatusString()` → `'success' | 'failed' | 'partial_success' | 'not_run' | 'no_tests' | 'unknown'`.
- **Data desensitization:** All JSON files in `json/` have had internal IPs (`10.x.x.x`), usernames (`/home/<user>/`), and internal hostnames replaced with placeholders. New data added to `json/` should go through the same sanitization.

## 全流程工作流 (End-to-End Pipeline)

本项目包含 4 个 skill，覆盖从仓库验证到飞书表格刷新的完整链路：

```
ttfhw-verify-pro          ttfhw-report-normalizer       Next.js Build          ttfhw-feishu-update
(验证仓库生成JSON)    →    (归一化JSON到json/)     →    (构建静态页面)    →    (刷新飞书Excel)
```

### 流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. ttfhw-verify-pro                                                        │
│  对目标仓库执行验证：阅读README → 启动容器 → 安装依赖 →                      │
│  构建 → UT → 样例执行 → 静态检查(pre-commit/lint-runner) →                  │
│  生成原始JSON → 归档到 json-org-630/                                        │
│                                                                             │
│  输出: json-org-630/verification_report_WSL_<repo>_<YYYYMMDD>.json          │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. ttfhw-report-normalizer                                                  │
│  读取 json-org-630/ 中的原始JSON → 理解内容 → 检测格式 →                    │
│  归一化状态值为5种标准值 → 保留所有v630字段 →                                │
│  写入 json/ 目录 → 清理重建项目                                              │
│                                                                             │
│  状态归一化:                                                                 │
│    success / partial_success / failed / not_run / no_tests                   │
│                                                                             │
│  输出: json/verification_report_WSL_<repo>_<YYYYMMDD>.json                  │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. Next.js 静态站点构建                                                     │
│  npm run build                                                              │
│                                                                             │
│  读取 json/ → data-loader.ts → React组件 → 静态HTML                         │
│  output: 'export' + basePath: '/ttfhw-report' → out/ → docs/                │
│                                                                             │
│  输出: docs/ (13个页面: 首页 + 10仓库详情 + 404 + _not-found)               │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. ttfhw-feishu-update                                                     │
│  读取 json/ 归一化数据 → 匹配飞书表格行 → 构建批量更新 →                    │
│  lark-cli sheets +batch-update --as user                                    │
│                                                                             │
│  写入17列: 验证结果/总时长/构建/UT/样例/pre-commit/devcontainer/验证问题      │
│                                                                             │
│  输出: 飞书表格 F-V 列刷新完成                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Skill 详情

#### 1. ttfhw-verify-pro — 仓库验证

模拟外部新手开发者，从 README 出发，在容器中完成构建/UT/样例验证。

**核心约束**：
- 只看文档，不猜测
- 缺少依赖必须先尝试安装，不得直接失败
- 不改源码
- 记录每一步耗时

**触发**: 用户说 "验证XXX仓库"、"跑ttfhw验证"、"verify repo"

#### 2. ttfhw-report-normalizer — JSON 归一化

将 `json-org-630/` 中的原始报告转换为统一结构，放入 `json/`。

**核心功能**：
- 检测格式（legacy/stratovirt/openEuler/shmem/manifest/kutacc）
- 归一化状态值为 5 种标准值
- 保留 v630 新增字段（static_analysis/devcontainer/duration_breakdown等）
- 脱敏处理（用户名→`<user>`，主机名→`<hostid>`，容器ID→`<container-id>`）
- 清理 `.next` 并重新构建

**触发**: `/ttfhw-report-normalizer` 或 "归一化报告"

#### 3. Next.js 静态站点 — 页面渲染

从 `json/` 读取数据，渲染为静态 HTML 页面，部署到 GitHub Pages。

**命令**:
```bash
rm -rf .next out docs && npm run build && mv out docs && touch docs/.nojekyll
```

#### 4. ttfhw-feishu-update — 飞书表格刷新

从 `json/` 归一化数据提取 17 列，批量写入飞书电子表格。

**前置条件**：
- `lark-cli config init --new`（应用配置）
- `lark-cli auth login --scope "sheets:spreadsheet"`（用户授权）
- 应用后台开通 read + write_only 权限

**触发**: 用户说 "刷新飞书表格"、"更新验证状态到飞书"

### 新增仓库的完整操作流程

```bash
# Step 1: 验证仓库
/ttfhw-verify-pro <repo-url>
# → 生成 json-org-630/verification_report_WSL_<repo>_<YYYYMMDD>.json

# Step 2: 归一化
/ttfhw-report-normalizer
# → 归一化到 json/，重新构建

# Step 3: 部署到 GitHub Pages
git add docs/ && git commit -m "deploy: update static pages" && git push github v6

# Step 4: 刷新飞书表格
/ttfhw-feishu-update
# → 输入表格URL，批量更新单元格
```

### 数据目录说明

| 目录 | 内容 | 状态 |
|------|------|------|
| `json-org-630/` | ttfhw-verify-pro 生成的原始 JSON | 原始数据，状态值未标准化 |
| `json/` | 归一化后的 JSON | 状态值已标准化，已脱敏 |
| `json-org-630/` 以外的 `json-org*/` | 旧版原始数据归档 | 已废弃，可删除 |
| `docs/` | Next.js 静态导出 (GitHub Pages) | 生产部署 |

### v630 新增字段

| 字段 | 位置 | 说明 |
|------|------|------|
| `static_analysis` | final_results | pre_commit + lint_runner 配置和结果 |
| `devcontainer` | final_results | .devcontainer 配置状态 |
| `duration_breakdown` | final_results.build | 多次构建尝试的耗时分解 |
| `command` | final_results.build | 实际执行的构建命令 |
| `concurrency` | final_results.build | 构建并发数 |
| `skip_reason` | final_results.ut | UT 跳过原因 |
| `smoke_test_after_install` | final_results.sample | 产物安装后冒烟测试 |
| `error`/`returncode`/`duration_seconds` | execution_log[] | 每个步骤的扩展信息 |

### 5 种标准状态

| 状态值 | 中文标签 | 含义 |
|--------|---------|------|
| `success` | 成功 | 全部通过 |
| `partial_success` | 部分成功 | 部分通过或有条件限制 |
| `failed` | 失败 | 执行失败 |
| `not_run` | 无法执行 | 环境不具备（如无 NPU 硬件） |
| `no_tests` | 无用例 | 仓库无测试/示例 |
