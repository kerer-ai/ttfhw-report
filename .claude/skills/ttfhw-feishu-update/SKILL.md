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
| M | 构建失败原因 | ⚠️ 见下方「失败原因提取」 |
| N | 测试 | final_results.ut.status → 中文标签 |
| O | 测试失败原因 | ⚠️ 见下方「失败原因提取」 |
| P | 样例执行 | final_results.sample.status → 中文标签 |
| Q | 样例失败原因 | ⚠️ 见下方「失败原因提取」 |
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

### ⚠️ 失败原因提取（M/O/Q 列）

`build.error` 和 `ut.skip_reason` 经常为 `null` 或 `"unknown"`，**不能直接取空值**。必须按以下优先级逐级 fallback：

```python
def extract_build_fail_reason(build, execution_log, problems):
    """M列：构建失败原因"""
    status = build.get('status', '')
    if status == 'success':
        return ''  # 成功不写原因

    # 1. 直接用 build.error / build.reason
    error = build.get('error') or build.get('reason')
    if error and error != 'unknown':
        return truncate(str(error), 200)

    # 2. 从 execution_log 提取最后一个失败步骤的 error
    if execution_log:
        for step in reversed(execution_log):
            if not step.get('success') and step.get('error'):
                err = str(step['error']).strip()
                if err:
                    return truncate(err, 200)

    # 3. 从 problems_encountered 提取第一个问题的 problem+solution
    if problems:
        p = problems[0]
        text = p.get('problem', '')
        if p.get('solution'):
            text += '；解决：' + str(p['solution'])
        if text.strip():
            return truncate(text.strip(), 200)

    return ''

def extract_test_fail_reason(ut, execution_log, problems):
    """O列：测试失败原因"""
    status = ut.get('status', '')
    if status == 'success' or status == 'no_tests':
        return ''  # 成功/无用例不写原因

    # 1. 有 failures 详情 → 提取前3条
    failures = ut.get('failures')
    if failures and isinstance(failures, list) and len(failures) > 0:
        reasons = []
        for f in failures[:3]:
            r = f.get('reason') or f.get('test_name') or ''
            if r:
                reasons.append(str(r)[:80])
        if reasons:
            return truncate(f'{len(failures)}个用例失败: ' + '; '.join(reasons), 200)

    # 2. 用 skip_reason（排除 "unknown"）
    skip = ut.get('skip_reason')
    if skip and skip != 'unknown':
        return truncate(str(skip), 200)

    # 3. 用 ut.reason
    reason = ut.get('reason')
    if reason and reason != 'unknown':
        return truncate(str(reason), 200)

    # 4. 从 execution_log 提取相关错误
    if execution_log:
        for step in reversed(execution_log):
            if not step.get('success') and step.get('error'):
                err = str(step['error']).strip()
                if err and ('test' in err.lower() or 'ut' in err.lower() or 'fail' in err.lower()):
                    return truncate(err, 200)
        # 任意最后一个错误
        for step in reversed(execution_log):
            if not step.get('success') and step.get('error'):
                return truncate(str(step['error']).strip(), 200)

    # 5. 从 problems_encountered
    if problems:
        p = problems[0]
        text = p.get('problem', '')
        if p.get('solution'):
            text += '；解决：' + str(p['solution'])
        if text.strip():
            return truncate(text.strip(), 200)

    # 6. 对于 not_run：衍生通用原因
    if status == 'not_run':
        return '需要 NPU 硬件或 CANN 环境，当前 x86_64 CPU 环境不具备'

    return ''

def extract_sample_fail_reason(sample, problems, execution_log):
    """Q列：样例失败原因"""
    status = sample.get('status', '')
    if status == 'success' or status == 'no_tests':
        return ''

    # 1. 直接用 sample.reason
    reason = sample.get('reason')
    if reason and reason != 'unknown':
        return truncate(str(reason), 200)

    # 2. 从 sample.results 提取失败样例
    results = sample.get('results')
    if results and isinstance(results, list):
        failures = [r for r in results if r.get('execution_status') not in ('success', 'unknown', 'passed')]
        if failures:
            names = [f.get('sample_name', '') for f in failures[:3]]
            return truncate('失败样例: ' + ', '.join(names), 200)

    # 3. 从 smoke_test_after_install 提取
    smoke = sample.get('smoke_test_after_install')
    if smoke and isinstance(smoke, dict):
        status_s = smoke.get('status', '')
        if status_s and 'fail' in str(status_s).lower():
            interp = smoke.get('interpretation', '')
            return truncate(str(status_s) + (' — ' + str(interp) if interp else ''), 200)

    # 4. 从 problems_encountered
    if problems:
        p = problems[0]
        text = p.get('problem', '')
        if text.strip():
            return truncate(text.strip(), 200)

    # 5. 对于 not_run：衍生通用原因
    if status == 'not_run':
        return '需要 NPU 硬件 / 环境不具备'

    return ''

def truncate(s, max_len):
    """截断到 max_len 字符，保留完整 UTF-8"""
    if len(s) <= max_len:
        return s
    return s[:max_len-3] + '...'
```

**关键规则：**
- 状态为 `success` 的不写原因（留空），不管是否有 error 字段
- `skip_reason` 值为 `"unknown"` 时视为无数据，继续 fallback
- 所有原因截断到 200 字符以内

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
- [ ] 步骤 6：验证写入结果 — **抽样读取 3-5 行检查关键列数据合理性**

## 历史Bug与防错机制

以下每个 bug 都曾真实发生，每次执行本 skill 时必须主动规避：

### Bug 1: 行遗漏（硬编码映射）
**现象**: hccl/metadef/graph-autofusion 等 5 行未被写入。
**根因**: skill 示例中的 `SHEET_ROWS` 硬编码了 11 个仓库，实际表格有 50+ 行。
**防错**: ❌ 禁止使用硬编码映射。✅ 必须从表格 C 列动态读取所有行。✅ 步骤 3.5 覆盖率报告强制暴露遗漏。

### Bug 2: pre-commit hooks 全显示 0
**现象**: 30 个仓库 pre-commit 已配置但 hooks 数显示 "0个hooks, 0通过 0失败 0跳过"。
**根因**: 所有归一化 JSON 使用平铺格式 (`pre_commit.total_hooks`) 而非嵌套格式 (`pre_commit.results.total`)，但 `extract_precommit()` 只读了嵌套路径。
**防错**: ✅ 提取数据时必须**同时检查两种结构**（平铺 + 嵌套），以非零值为准。
```python
# 正确做法：先读平铺，再 fallback 嵌套
total = pc.get('total_hooks', 0) or pc.get('total', 0) or 0
res = pc.get('results', {})
if isinstance(res, dict):
    total = total or res.get('total', 0) or res.get('total_hooks', 0) or 0
```

### Bug 3: 同名仓库模糊匹配冲突
**现象**: MindIE-LLM 错误匹配到 MindIE-SD 所在行。
**根因**: "mindielm" 与 "mindiesd" 的模糊匹配得分过于接近，且先到先得无冲突解决。
**防错**: ✅ 模糊匹配后必须做**冲突检测**：同一 JSON 文件取最高分行，同一表格行取最高分 JSON。✅ 对被冲突淘汰的文件明确报告原因。

### Bug 4: 归一化数据源缺陷传播
**现象**: ubs-io 时长全为空、UT 326 通过却显示"无用例"。
**根因**: 归一化后的 JSON 本身就有数据丢失（duration=0、UT 状态错误），飞书刷新原样写入。
**防错**: ✅ 步骤 6 验证时必须**抽样检查数据合理性**：时长为 0 但构建状态为成功的行应告警，UT 状态与测试数量矛盾应告警。

### Bug 5: pre-commit 键名变体导致显示"-"
**现象**: kupl 原始数据有 pre-commit（7 个 hooks），飞书表格却显示"-未配置"。
**根因**: 不同验证运行产出的 pre-commit 键名不统一 — 多数用 `configured`，kupl 用 `config_exists`。归一化 skill 透传原始键名不做标准化，ops 生成脚本只检查 `pc.get('configured')`，`config_exists: true` 掉入 else 分支显示 "-"。
**防错**: ✅ `extract_precommit()` 必须同时检查 `configured` 和 `config_exists` 两个键名，以非 None 值为准。
```python
pc_configured = pc.get('configured')
if pc_configured is None:
    pc_configured = pc.get('config_exists')
```

### Bug 6: devcontainer 键名变体导致显示"-"
**现象**: torchair/MindSpeed-MM/MindSpeed/bishengjdk-8 四个仓库原始数据 devcontainer 已标记为未配置，飞书表格却显示"-"。
**根因**: 归一化后 devcontainer 用 `configured: false`，ops 生成脚本只检查 `dc.get('enabled')`。`configured` ≠ `enabled`，`None` 落入 else 显示 "-"。
**防错**: ✅ `extract_devcontainer()` 必须同时检查 `enabled` 和 `configured` 两个键名。
```python
dc_enabled = dc.get('enabled')
if dc_enabled is None:
    dc_enabled = dc.get('configured')
```

### 系统性改进：步骤 4 增加数据校验层

以上 Bug 5/6 的深层根因是：ops 生成脚本**假设归一化数据使用单一键名**，但归一化 skill 并未对子字段键名做标准化。
在步骤 4 生成 operations 前，增加校验步骤：

```python
# 在所有文件匹配完成后、生成 operations 之前，扫描关键字段的键名变体
KEY_VARIANTS = {
    'pre_commit.configured': ['configured', 'config_exists'],
    'devcontainer.enabled': ['enabled', 'configured'],
}
# 输出告警：发现非预期键名时，列出文件名和实际键名
```

**长期修复**：在 `ttfhw-report-normalizer` 中将子字段键名标准化（`config_exists` → `configured`，`devcontainer.configured` → `devcontainer.enabled`），从源头消除变体。

## 绑定资源

### assets/column-mapping.json

表头-字段映射模板，记录了标准列结构与 JSON 字段的对应关系。
