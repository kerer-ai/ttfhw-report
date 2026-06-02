# TTFHW Build Verification Dashboard

TTFHW 仓库编译验证结果可视化仪表盘，覆盖多个社区、数十个仓库的编译/单元测试/示例执行验证数据。

## 技术栈

- Next.js 16 (App Router)
- React 18 + TypeScript
- Tailwind CSS + Recharts
- 静态站点生成 (SSG)

## 快速开始

```bash
npm install
npm run dev      # 开发模式 → http://localhost:3000
npm run build    # 生产构建
npm run start    # 生产运行
```

## 使用规则

### 业务人员：提交验证报告

1. 使用 ttfhw-verify / ttfhw-verify-pro 技能完成对应仓库的构建验证
2. 将生成的原始 JSON 报告文件放入 `json-org/` 目录
3. 提交并推送到远端仓库

### 归一化处理

原始 JSON 报告格式多样，需要归一化为统一模板结构才能被仪表盘渲染。使用 `ttfhw-report-normalizer` skill：

**全量比对归一化**（不带参数）：

```
/ttfhw-report-normalizer
```

对比 `json-org/`（原始）和 `json/`（归一化）两个目录，自动识别新增文件，逐个归一化后放入 `json/`，然后清理旧的静态页面并重新构建。

**指定文件归一化**（带文件名参数）：

```
/ttfhw-report-normalizer verification_report_WSL_hcomm_20260520.json
```

仅对 `json-org/` 下指定的原始文件进行归一化，输出到 `json/` 目录，清理并重新构建。

### 归一化规则

- 不捏造数据：原始数据缺失的字段标记为 `"unknown"`、`0` 或 `[]`
- 不删除字段：模板结构的所有字段必须保留
- 状态归一化：将各种状态字符串统一为 `success` / `failed` / `partial_success` / `not_run` / `unknown`
- URL 处理：原始数据没有仓库 URL 时留空，不填入本地路径
- 仓库名推断：优先使用原始数据中的 `repo_name`，其次从 `repo_url` 推断

## 数据目录

| 目录 | 用途 |
|------|------|
| `json-org/` | 原始验证报告 JSON（ttfhw-verify 生成，格式多样） |
| `json/` | 归一化后的 JSON（统一模板结构，供仪表盘渲染） |

## 项目结构

```
app/              # Next.js 页面 (首页 + 详情页)
components/       # React 组件 (图表/卡片/表格/筛选)
lib/              # 数据加载/类型定义/工具函数
json/             # 归一化后的验证报告数据
json-org/         # 原始验证报告数据
.claude/skills/   # 项目共享的 Claude Code skills
```
