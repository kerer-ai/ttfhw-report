---
name: ttfhw-feishu-update
description: 基于 json-org-630/ 中的原始验证报告刷新飞书电子表格中的仓库验证状态。使用 lark-cli sheets 命令更新单元格。当用户需要刷新飞书表格、更新验证状态、同步报告数据到飞书时使用。
---

# TTFHW 飞书表格刷新

## 概述

读取 `json-org-630/` 目录中的原始验证报告 JSON 文件，提取每个仓库的核心验证数据，使用飞书 CLI (`lark-cli`) 批量更新飞书电子表格中的单元格。

## 前置条件

飞书 CLI 必须已安装并完成认证：

```bash
lark-cli auth status          # 检查认证状态
lark-cli config init --new    # 首次配置（需打开授权链接）
```

## 工作流程

### 步骤 1：确认目标表格

**必须向用户确认要刷新的表格**。提示用户输入飞书表格 URL，格式如：

```
https://vcnpr8ydwid3.feishu.cn/sheets/<spreadsheet_token>?sheet=<sheet_id>
```

从 URL 中提取：
- `spreadsheet_token`：路径中 `/sheets/` 后的部分
- `sheet_id`：query 参数 `sheet` 的值

**默认模板**（如用户未提供）：
- 表格：`https://vcnpr8ydwid3.feishu.cn/sheets/ZP68slCR4hWamttGwIDc08GsnZf?sheet=m66BDJ`
- spreadsheet_token: `ZP68slCR4hWamttGwIDc08GsnZf`
- sheet_id: `m66BDJ`

### 步骤 2：读取当前表格结构

先读取目标 sheet 的前几行，了解表头和数据布局：

```bash
lark-cli sheets +cells-get \
  --spreadsheet-token <token> \
  --sheet-id <sheet_id> \
  --range "A1:Z5" \
  --json
```

从返回的数据中识别：
- 表头行（通常是第 1 行）：确定每列的含义
- 数据起始行：表头下方的第一行
- 仓库名所在的列

### 步骤 3：读取 JSON 验证数据

遍历 `json-org-630/` 目录中每个 JSON 文件，提取以下关键字段：

```bash
# 字段提取脚本
python3 -c "
import json, os

REPORT_FIELDS = {
    'repo_name':     'metadata.repo_path 或文件名推导',
    'build_status':  'final_results.build.status',
    'ut_status':     'final_results.ut.status',
    'sample_status': 'final_results.sample.status',
    'total_tests':   'final_results.ut.total',
    'passed_tests':  'final_results.ut.passed',
    'failed_tests':  'final_results.ut.failed',
    'build_cmd':     'final_results.build.command',
    'build_dur':     'final_results.build.duration_seconds',
    'ut_dur':        'final_results.ut.duration_seconds',
    'sample_dur':    'final_results.sample.duration_seconds',
    'total_dur':     'metadata.duration_seconds',
    'pre_commit':    'final_results.static_analysis.pre_commit.configured',
    'pc_total':      'final_results.static_analysis.pre_commit.total_hooks',
    'pc_passed':     'final_results.static_analysis.pre_commit.passed',
    'pc_failed':     'final_results.static_analysis.pre_commit.failed',
    'lint_runner':   'final_results.static_analysis.lint_runner.configured',
    'lr_linters':    'final_results.static_analysis.lint_runner.active_linters',
    'devcontainer':  'final_results.devcontainer.enabled',
    'repo_url':      'metadata.repo_url',
    'branch':        'metadata.branch',
    'start_time':    'metadata.start_time',
    'end_time':      'metadata.end_time',
}
"
```

### 步骤 4：状态值标准化

JSON 中的状态值需要转换为飞书表格中使用的标准中文标签：

| JSON 状态 | 表格显示 |
|-----------|---------|
| `success` | 成功 |
| `partial_success` | 部分成功 |
| `failed` | 失败 |
| `not_run` | 无法执行 |
| `no_tests` | 无用例 |
| `configured: true` | ✓ |
| `configured: false` | ✗ |
| `configured: null/undefined` | - |

### 步骤 5：构建批量更新

将提取的数据映射到表格的对应列。使用 `lark-cli sheets +batch-update` 一次性提交所有更新：

```bash
lark-cli sheets +batch-update \
  --spreadsheet-token <token> \
  --sheet-id <sheet_id> \
  --requests '[
    {"updateCells": {
      "range": "B2:D2",
      "values": [["成功", "99.9%", "✓"]]
    }},
    {"updateCells": {
      "range": "B3:D3",
      "values": [["部分成功", "96%", "✗"]]
    }}
  ]'
```

**关键规则**：
- 一行一个 `updateCells` 请求，覆盖该仓库的所有数据列
- 先写后确认：先用 `--dry-run` 预览，用户确认后再执行
- 大量数据用 JSON 文件传入：`--requests @data.json`

### 步骤 6：验证刷新结果

更新后重新读取表格验证数据是否正确：

```bash
lark-cli sheets +cells-get \
  --spreadsheet-token <token> \
  --sheet-id <sheet_id> \
  --range "A1:Z20" \
  --json
```

## 表头-字段映射参考

根据模板 sheet6 的常见列结构，默认映射如下（实际以步骤 2 读取的表头为准）：

| 列 | 内容 | JSON 来源 |
|----|------|----------|
| A | 仓库名 | 文件名推导 |
| B | 整体结果 | derive from build+ut+sample |
| C | 构建状态 | final_results.build.status |
| D | UT 状态 | final_results.ut.status |
| E | Sample 状态 | final_results.sample.status |
| F | UT 通过率 | ut.passed/ut.total |
| G | 总耗时 | metadata.duration_seconds |
| H | 构建命令 | final_results.build.command |
| I | Pre-commit | static_analysis.pre_commit.configured |
| J | Pre-commit Hooks | pre_commit.total/passed/failed |
| K | Lint-runner | static_analysis.lint_runner.configured |
| L | Devcontainer | devcontainer.enabled |

**实际映射以步骤 2 读取的真实表头为准，灵活调整。**

## 安全规则

- 更新前必须用 `--dry-run` 预览，经用户确认
- 批量更新用 `--yes` 跳过确认（仅限用户已确认的预览内容）
- 不在表格中写入密钥、密码等敏感信息

## 绑定资源

### assets/column-mapping.json

表头-字段映射模板，可用于自定义列对应关系。
