---
name: ttfhw-feishu-update
description: 基于 json/ 中的归一化验证报告刷新飞书电子表格中的仓库验证状态。使用 lark-cli sheets 命令更新单元格。当用户需要刷新飞书表格、更新验证状态、同步报告数据到飞书时使用。
---

# TTFHW 飞书表格刷新

## 概述

读取 `json/` 目录中的**归一化后**验证报告 JSON 文件（状态值已标准化），提取每个仓库的核心验证数据，匹配飞书电子表格中的对应行，使用飞书 CLI (`lark-cli`) 批量更新单元格。

## 前置条件

飞书 CLI 必须已安装并完成两层认证：

```bash
# 1. 应用配置（bot 身份，用于读取表格）
lark-cli config init --new

# 2. 用户登录（user 身份，用于写入表格）
#    bot 无法写入用户创建的表格，必须用 --as user
lark-cli auth login --scope "sheets:spreadsheet:write_only" --no-wait --json
#    拿到 URL 和 device_code，用户扫码授权后：
lark-cli auth login --device-code <code>
```

**权限要求**：
- 应用后台开通：`sheets:spreadsheet:read` + `sheets:spreadsheet:write_only`
- 用户授权：`sheets:spreadsheet` + `sheets:spreadsheet:write_only`

## 工作流程

### 步骤 1：确认目标表格

**必须向用户确认要刷新的表格**。提示用户输入飞书表格 URL。默认模板：

```
https://vcnpr8ydwid3.feishu.cn/sheets/ZP68slCR4hWamttGwIDc08GsnZf?sheet=m66BDJ
```

提取：
- `spreadsheet_token`：`ZP68slCR4hWamttGwIDc08GsnZf`
- `sheet_id`：`m66BDJ`

### 步骤 2：读取表格结构

读取完整表头和数据行（范围要足够大，覆盖所有行）：

```bash
lark-cli sheets +cells-get \
  --spreadsheet-token <token> \
  --sheet-id <sheet_id> \
  --range "A1:V60" \
  --json
```

从返回数据识别：
- **表头行**（第 1 行）：确定每列含义
- **仓库名列**（通常是 C 列）：用于匹配 JSON 数据
- **数据填充范围**：表头下方的所有行，列 F-V 为待写入区域

### 步骤 3：提取 JSON 数据并构建写入操作

**数据源**：使用 `json/` 目录（归一化后的数据，状态值已标准化为 success/partial_success/failed/not_run/no_tests）。

用 Python 脚本读取所有 JSON 文件，提取字段，匹配表格行，构建 `+batch-update` 所需的 operations。

**关键步骤**：
1. 读取 `json/` 下所有 JSON 文件
2. 从文件名提取仓库标识，通过映射表匹配表格行号
3. 提取归一化后的状态值（已经是标准值，无需再转换）
4. 构建 `[[{"value": "..."}, ...], ...]` 格式的 cells 数据
5. 生成 `[{"shortcut": "+cells-set", "input": {...}}, ...]` 格式的 operations

**仓库名映射表**（JSON 文件名 -> 表格行号）：

```python
# JSON 文件名中的 repo key -> 表格中仓库名 -> 行号
SHEET_ROWS = {
    'ubs-engine': 2, 'ubs-comm': 3, 'ubs-virt': 4, 'ubs-io': 5,
    'ubs-mem': 6, 'pytorch': 31, 'kernel': 34, 'isulad': 35,
    'a-tune': 36, 'stratovirt': 37,
}
```

**表格列映射**（F-V 列共 17 列）：

| 列 | 内容 | 来源 |
|----|------|------|
| F | 验证结果 | 综合判断: build=success AND ut=success AND sample in (success,no_tests) → 成功，否则 build/ut 任一 success/partial → 部分成功 |
| G | 总时长 | metadata.duration_seconds，格式化为 XhXmXs |
| H | 环境准备时长 | 总时长 - 构建 - UT - 样例 |
| I | 构建时长 | final_results.build.duration_seconds |
| J | 测试时长 | final_results.ut.duration_seconds |
| K | 样例时长 | final_results.sample.duration_seconds |
| L | 构建 | final_results.build.status → 中文标签 |
| M | 构建失败原因 | build.error 或 skip_reason |
| N | 测试 | final_results.ut.status → 中文标签 |
| O | 测试失败原因 | ut.failures 详情 或 ut.skip_reason |
| P | 样例执行 | final_results.sample.status → 中文标签 |
| Q | 样例失败原因 | 环境不具备 / 需NPU硬件 等 |
| R | pre-commit是否配置 | static_analysis.pre_commit.configured → ✓/✗/- |
| S | pre-commit结果 | N个hooks, X通过 Y失败 Z跳过 |
| T | devcontainer是否配置 | devcontainer.enabled → ✓/✗/- |
| U | devcontainer结果 | 配置N个文件 / 未配置 |
| V | 验证问题 | problems_encountered 前3条，截断200字符 |

状态标签映射：

```python
STATUS = {
    'success': '成功', 'partial_success': '部分成功', 'failed': '失败',
    'not_run': '无法执行', 'no_tests': '无用例', 'unknown': '未知',
}
```

### 步骤 4：预览并执行

1. **先 dry-run**：确认数据正确
2. **用户确认后执行**：

```bash
# Dry-run
lark-cli sheets +batch-update \
  --spreadsheet-token <token> \
  --operations @feishu-ops.json \
  --as user --dry-run

# 执行（用户确认后加 --yes）
lark-cli sheets +batch-update \
  --spreadsheet-token <token> \
  --operations @feishu-ops.json \
  --as user --yes --json
```

**注意**：
- `+batch-update` 是高风险操作，需 `--yes` 确认
- 必须用 `--as user`（bot 无权限写用户表格）
- operations 文件路径必须是相对路径（如 `./feishu-ops.json`）
- 每个 operation 格式：`{"shortcut": "+cells-set", "input": {"sheet_id": "...", "range": "F2:V2", "cells": [[{"value": "..."}, ...]]}}`

### 步骤 5：验证

更新后读取表格确认：

```bash
lark-cli sheets +cells-get \
  --spreadsheet-token <token> \
  --sheet-id <sheet_id> \
  --range "F2:V40" \
  --json
```

## 安全规则

- ⚠️ 更新前必须 `--dry-run` 预览
- ⚠️ 执行前必须用户确认
- ⚠️ 必须用 `--as user` 写用户表格
- ⚠️ 不在表格中写入密钥、密码等敏感信息

## 绑定资源

### assets/column-mapping.json

表头-字段映射模板，记录了标准列结构与 JSON 字段的对应关系。
