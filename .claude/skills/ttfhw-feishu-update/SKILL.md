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

### 步骤 2：读取表格结构并构建动态映射

**重要：不要使用硬编码的映射表。** 必须从表格动态读取仓库名→行号映射。

读取完整表头和数据行（范围要足够大，覆盖所有行）：

```bash
lark-cli sheets +cells-get \
  --spreadsheet-token <token> \
  --sheet-id <sheet_id> \
  --range "A1:V60" \
  --json
```

从返回数据提取 C 列的仓库名清单，构建 repo_name → row_number 的完整映射。

### 步骤 3：全量匹配 json/ 与表格行

**核心原则：读取 json/ 下**所有** JSON 文件，与表格**所有**行进行模糊匹配，生成完整的覆盖计划。**

使用以下 Python 脚本完成全量匹配和数据提取。脚本必须包含以下逻辑：

1. 读取表格所有行（步骤 2 的输出），提取 `{repo_name: row_number}` 映射
2. 读取 `json/` 下所有 JSON 文件，提取 repo key
3. **模糊匹配**：repo key 与表格 repo_name 做大小写不敏感的包含匹配
   - `WSL_hccl` 匹配 `hccl`
   - `WSL_graph-autofusion` 匹配 `graph-autofusion`
   - `op-plugin_master` 匹配 `op-plugin`
   - `MindSpeed_master` 匹配 `Mindspeed`
4. **输出覆盖率报告**（步骤 3.5）
5. 对所有**已匹配的行**生成 operations（默认全量覆盖，确保不遗漏）

### 步骤 3.5：覆盖率校验（必须执行）

在生成 operations **之前**，必须输出以下两份清单：

```
=== 表格中有行但 json/ 中无匹配文件的仓库（无法写入）===
  Row XX: <表格中仓库名> — 需先验证该仓库并归一化

=== json/ 中有文件但表格中无匹配行的仓库（无法写入）===
  <文件名> — 需在表格中新增行
```

**用户确认覆盖计划后**再生成 operations。

### 步骤 4：生成并预览 operations

使用内置的 `assets/generate_ops.py` 脚本（或等价逻辑）生成 operations：

```bash
python3 << 'PYEOF'
import json, os, re

STATUS = {
    'success': '成功', 'partial_success': '部分成功', 'failed': '失败',
    'not_run': '无法执行', 'no_tests': '无用例', 'unknown': '未知',
}

# ... (完整的数据提取和 operation 生成逻辑)

# 关键：遍历 json/ 下所有文件，对每个匹配到的表格行生成 operation
# 不遗漏任何一个已匹配的行
PYEOF
```

**列映射**（F-V 共 17 列）：

| 列 | 内容 | 来源 |
|----|------|------|
| F | 验证结果 | 综合判断 |
| G | 总时长 | metadata.duration_seconds |
| H | 环境准备时长 | 总时长 - 构建 - UT - 样例 |
| I | 构建时长 | final_results.build.duration_seconds |
| J | 测试时长 | final_results.ut.duration_seconds |
| K | 样例时长 | final_results.sample.duration_seconds |
| L | 构建 | final_results.build.status → 中文标签 |
| M | 构建失败原因 | build.error 或 skip_reason |
| N | 测试 | final_results.ut.status → 中文标签 |
| O | 测试失败原因 | ut.failures / ut.skip_reason |
| P | 样例执行 | final_results.sample.status → 中文标签 |
| Q | 样例失败原因 | 环境不具备 / 需NPU硬件 等 |
| R | pre-commit是否配置 | static_analysis.pre_commit.configured → ✓/✗/- |
| S | pre-commit结果 | N个hooks, X通过 Y失败 Z跳过 |

**⚠️ pre_commit 数据结构**：hooks 计数有两种存放位置，提取时必须两处都检查：
- **平铺格式**（主要）：`pre_commit.total_hooks` / `.passed` / `.failed` / `.skipped`
- **嵌套格式**：`pre_commit.results.total` / `.passed` / `.failed` / `.skipped`

```python
total = pc.get('total_hooks', 0) or pc.get('total', 0) or 0
passed = pc.get('passed', 0) or 0
# fallback to nested
res = pc.get('results', {})
if isinstance(res, dict):
    total = total or res.get('total', 0) or res.get('total_hooks', 0) or 0
    passed = passed or res.get('passed', 0) or 0
```
| T | devcontainer是否配置 | devcontainer.enabled → ✓/✗/- |
| U | devcontainer结果 | 配置N个文件 / 未配置 |
| V | 验证问题 | problems_encountered 前3条，截断200字符 |

**综合判断逻辑**：

```python
def compute_summary(build_st, ut_st, sample_st):
    if build_st == 'success' and ut_st == 'success' and sample_st in ('success', 'no_tests'):
        return '成功'
    if build_st in ('success', 'partial_success') or ut_st in ('success', 'partial_success'):
        return '部分成功'
    if build_st == 'failed' and ut_st == 'failed':
        return '失败'
    return '部分成功'
```

**模糊匹配逻辑**：

```python
def match_repo_to_row(json_key, table_rows):
    """将 JSON 文件中的 repo key 匹配到表格行号。
    
    json_key: 如 'WSL_hccl', 'op-plugin_master', 'MindSpeed_master'
    table_rows: {row_num: '表格中仓库名', ...}
    """
    key_lower = json_key.lower().replace('_', '').replace('-', '')
    for row_num, table_name in table_rows.items():
        tn_lower = table_name.lower().replace('_', '').replace('-', '').replace('/', '')
        # 包含匹配或完全匹配
        if key_lower == tn_lower or key_lower in tn_lower or tn_lower in key_lower:
            return row_num
    return None
```

### 步骤 5：执行

1. **先 dry-run**：

```bash
lark-cli sheets +batch-update \
  --spreadsheet-token <token> \
  --operations @feishu-ops.json \
  --as user --dry-run
```

2. **用户确认后执行**：

```bash
lark-cli sheets +batch-update \
  --spreadsheet-token <token> \
  --operations @feishu-ops.json \
  --as user --yes --json
```

**注意**：
- `+batch-update` 是高风险操作，需 `--yes` 确认
- 必须用 `--as user`（bot 无权限写用户表格）
- operations 文件路径必须是相对路径（如 `./feishu-ops.json`）

### 步骤 6：验证

更新后读取所有已写入行确认：

```bash
lark-cli sheets +cells-get \
  --spreadsheet-token <token> \
  --sheet-id <sheet_id> \
  --range "F2:V55" \
  --json
```

## 安全规则

- ⚠️ 更新前必须 `--dry-run` 预览
- ⚠️ 执行前必须用户确认
- ⚠️ 必须用 `--as user` 写用户表格
- ⚠️ 不在表格中写入密钥、密码等敏感信息
- ⚠️ 必须使用动态表格映射，不得依赖硬编码的 SHEET_ROWS

## 防遗漏检查清单

执行本 skill 时，必须确保以下步骤全部完成：

- [ ] 步骤 2：从表格**动态读取**所有行的 C 列仓库名
- [ ] 步骤 3：**全量遍历** `json/` 下所有 JSON 文件
- [ ] 步骤 3.5：输出覆盖率报告（未匹配的表格行 + 未匹配的 JSON 文件）
- [ ] 步骤 4：对**所有已匹配行**生成 operations（不是只生成"新增"的）
- [ ] 步骤 5：dry-run 预览 → 用户确认 → 执行
- [ ] 步骤 6：验证写入结果

## 绑定资源

### assets/column-mapping.json

表头-字段映射模板，记录了标准列结构与 JSON 字段的对应关系。
