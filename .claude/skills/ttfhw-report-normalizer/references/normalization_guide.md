# ttfhw-verify 报告 JSON 归一化参考指南

## 模板结构（assets/report_template.json）

目标结构包含以下顶级键。每个归一化文件必须全部包含：

```
metadata              — repo_name, repo_path, repo_url, start_time, end_time, duration_seconds, total_steps
machine_spec          — host_machine, container, image_source
document_reading_summary — architecture, recommended_image, dependencies, build_commands, ut_commands, sample_commands, build_entry, ut_entry
execution_log[]       — {timestamp, command, success, output, error, returncode, duration_estimate?, note?}
process_timeline[]    — {timestamp, step, action, result, details{}}
final_results         — build{}, ut{}, sample{}
documentation_gaps[]  — 字符串数组
problems_encountered[] — {timestamp, problem, solution, source}
session_export_file   — 字符串
```

## 核心原则

1. **不捏造数据。** 仅重新组织已有数据。如果源数据中确实不存在某个值，字符串用 `"unknown"`，计数用 `0`，数组用 `[]`。
2. **灵活理解字段语义。** 不同格式对同一概念使用不同命名。按含义映射，而非按名称机械匹配。
3. **可增加额外字段，但绝不删除模板字段。**
4. **保留所有原始数据。** 额外键如 `cann_environment`、`verification_conclusion`、`recommendations`、`verdict` 可与模板字段共存。
5. **逐个阅读每个文件。** 在映射之前理解其内容叙事。不要盲目应用正则或脚本。

## 源格式检测

读取源 JSON 时，根据顶级键分类：

| 格式 | 识别特征 | 典型文件 |
|--------|-------------------|---------------|
| **legacy** | `metadata` + `final_results` | ~90% 的报告 |
| **stratovirt** | 仅有 `verification_summary`，内部含 `build_result` + `test_result` | stratovirt |
| **openEuler** | `verification_info` 顶级键 | bishengjdk |
| **manifest** | `build_verification` + `unit_tests` 顶级键 | manifest |
| **shmem** | `build_results` + `test_execution_results`（无 `final_results`） | SHMEM |

## 各源格式的字段映射

### 1. Legacy 格式（metadata + final_results）

已接近模板。关键映射：

**metadata：**
- `repo_name` — 源：`metadata.repo_name`，或 `repo_info.name`，或从 `repo_url` 末尾路径段推断（去掉 `.git`），或从 `repo_path` 最后目录名推断。例如：`https://gitcode.com/cann/amct.git` → `amct`
- `repo_path` — 来自 `metadata.repo_path`
- `repo_url` — 来自 `metadata.repo_url`。清理损坏的 URL（如 `gitcodeP3390851com` → `gitcode.com`）
- `start_time`、`end_time`、`duration_seconds`、`total_steps` — 直接映射

**machine_spec：** 直接复制。宿主机、容器和镜像源信息已经结构良好。

**document_reading_summary：**
- 直接映射已有的 `architecture`、`recommended_image`、`dependencies`、`build_commands`、`ut_commands`、`sample_commands`
- **build_entry** — 以 `build_commands` 为来源，值相同
- **ut_entry** — 以 `ut_commands` 为来源，值相同
- 如果 `build_commands.value` 是数组，用 ` ; ` 连接

**execution_log / process_timeline：** 从源数组直接复制。

**final_results：**
- `build.status` — 归一化为标准值（见下方状态归一化章节）
- `build.duration_seconds` — 来自 `duration_seconds`
- `build.artifacts` — 若是字符串数组，转为 `[{name, path:"unknown", size:"unknown"}]`。若是对象数组，保留结构。若是带计数的对象（如 `{driver_libraries: 87}`），转为 `[{type, count}]`
- `ut.status` — 归一化；源：`ut.status` 或 `unit_test.status` 或 `unittest.status`
- `ut.total/passed/failed` — **先查平面字段**：`total`/`passed`/`failed`，同时检查 `total_tests`/`passed_tests`/`failed_tests`、`total_suites`/`passed_suites`/`failed_suites`、`total_runnable`、`collected`、`total_discovered`。**如果都为空，遍历命名子组件聚合**（见下方"UT 嵌套子组件处理"）
- `ut.failures` — 来自 `failures` 数组或 `failed_tests_detail`。字符串转为 `{test_name, reason:"unknown"}`
- `ut.sub_components` — 当 UT 数据来自嵌套子组件时，保留 `{组件名: {total, passed, failed, ...}}` 详情
- `sample.status` — 归一化；源：`sample.status` 或 `samples.status` 或 `sample_run.status`
- `sample.results` — 来自 `results` 数组

**documentation_gaps：** 直接复制。若是对象数组，提取 `issue` 或 `description` 字段。

**problems_encountered：** 映射为 `{timestamp, problem, solution, source}`。源字段可能名为 `issue`/`problem`/`description`、`solution`/`resolution`/`recommendation`、`source`/`location`。

### 2. Stratovirt 格式

仅有 `verification_summary` 顶级键。从子键提取：

- `metadata.repo_name` → `verification_summary.repository` 的末尾路径段（如 `.../stratovirt.git` → `stratovirt`）
- `metadata.repo_path` → `verification_summary.repository`
- `metadata.start_time` → `verification_summary.verification_date`
- `metadata.duration_seconds` → 解析 `build_result.duration` 字符串（"8m 48s" → 528 秒）
- `machine_spec.host_machine.architecture` → `environment.architecture`
- `machine_spec.container.os` → `environment.os`
- `final_results.build.status` → `build_result.status`："SUCCESS"→"success"，否则 "failed"
- `final_results.build.artifacts` → 从 `build_result.output_binary` + `binary_size`
- `final_results.ut.status` → `test_result.status`："SUCCESS"→"success"，"PARTIAL_FAILURE"→"partial_success"
- `final_results.ut.total/passed` → 来自 `test_result.total_tests`/`passed_tests`
- `final_results.ut.failures` → 来自 `test_result.failed_tests` 数组，以 `failure_reason` 为失败原因
- `final_results.sample` → "not_run"（未测试）
- `problems_encountered` → 来自 `issues_encountered` 数组
- `execution_log` → 从 build_result 的 command 合成
- `process_timeline` → 合成构建和测试阶段

### 3. openEuler 格式（bishengjdk）

有 `verification_info`、`execution_environment`、`build_execution`、`unit_tests`、`samples`。

- `metadata.repo_name` → 来自 `verification_info.repository`
- `metadata.start_time` → `verification_info.verification_date`
- `metadata.duration_seconds` → 解析 `build_execution.build_time`（"00:09:03" → 543 秒）
- `machine_spec.container.os` → `execution_environment.os`
- `machine_spec.image_source.image_name` → `execution_environment.docker_image`
- `final_results.build.status` → 映射中文："成功"/"已验证"→"success"，"失败"→"failed"
- `final_results.ut.status` → 优先使用 `test_results.status` 而非外层的 `ut.status`。映射："通过"→"success"
- `document_reading_summary.dependencies.value` → `dependency_installation.packages_installed`
- `document_reading_summary.build_commands.value` → `document_analysis.build_command` 或 `build_configuration.configure_command`
- `problems_encountered` → 来自 `issues_and_solutions`

### 4. SHMEM 格式

已有 `metadata`、`machine_spec`、`document_reading_summary`，外加 `build_results` 和 `test_execution_results`。

- `final_results.build.status` → 来自 `build_results.core_library.status`（找到第一个含 status 的组件）
- `final_results.build.artifacts` → 从所有 `build_results.*.artifacts` 和 `*.install_package` 收集
- `final_results.ut.status` → 来自 `test_execution_results.unit_test_run.status`，映射："executed_but_functional_fail"→"partial_success"
- `final_results.ut.total/passed/failed` → 来自 `unit_test_run.test_summary`
- `final_results.ut.failures` → 来自 `unit_test_run.failed_tests_detail`
- `final_results.sample` → 来自 `test_execution_results.example_run`
- 保留 `cann_environment`、`hardware_check` 作为额外字段

### 5. Manifest 格式

有 `metadata`、`machine_spec`、`document_reading_summary`、`build_verification`、`unit_tests`、`sample_execution`。

- `final_results.build.status` → 来自 `build_verification.overall_build_status`。映射："blocked"→"failed"
- `final_results.build.blockers` → 来自 `build_verification.blockers`
- `final_results.ut` → 来自 `unit_tests`。"not_configured"→"not_run"
- `final_results.sample` → 来自 `sample_execution`。"not_attempted"→"not_run"
- `execution_log` → 从 `build_verification` 子步骤合成
- `problems_encountered` → 来自 `issues_found` 数组。映射：`type`/`description`→`problem`，`recommendation`→`solution`

## 状态归一化

将所有状态字符串映射为 5 种标准值：

| 标准值 | 源数据模式 |
|----------|----------------|
| **success** | `success`、`passed`、`通过`、`成功`、`completed`、`completed_success`、`verified`、`已验证`、`SUCCESS` |
| **failed** | `failed`、`fail`、`failure`、`blocked`、`error`、`unsuccessful`、`失败`、`executed_but_crashed` |
| **partial_success** | `partial_success`、`partial_failure`、`partial`、`mostly_passed`、`completed_mostly`、`success_with_modifications`、`success_with_workaround`、`success_with_failures`、`executed_but_functional_fail`、`mostly_success`、`PARTIAL_FAILURE` |
| **not_run** | `not_run`、`skipped`、`not_executed`、`not_attempted`、`not_configured`、`not_applicable`、`not_attempted_container_environment`、`not_tested`、`cannot_verify`、`skipped_npu_required` |
| **unknown** | 以上均不匹配的：`ctest_no_tests_found`、`no_tests_available`、`incomplete`、`artifacts_available` — 这些确实缺乏明确信号，无法归入上述类别 |

## 常见问题与修复

### JSON 损坏（重要 — 归一化前必须先修复）

原始 JSON 文件可能因生成工具的缺陷而损坏，无法被 `JSON.parse()` 解析。归一化前必须先修复这些损坏。

#### 类型 1：中文引号变成 ASCII `"`

**症状**：`JSON.parse()` 报 `Expected ',' or ']' after array element`，位置在包含中文引号的文本行。

**原因**：ttfhw-verify 生成报告时，中文文本中的引号（如 "环境要求"、"CANN >= 8.5.0"）被写成 ASCII 双引号 `"`（U+0022），而 JSON 用 `"` 作为字符串定界符，导致字符串被提前截断。

**检测方法**：
```bash
node -e "JSON.parse(require('fs').readFileSync('json-org/xxx.json','utf-8'))"
```
如果报 `position N (line X column Y)`，阅读对应行，找中文文本中出现的裸 `"`。

**修复方法**：将中文引号对替换为 Unicode 弯引号 `"`（U+201C, LEFT DOUBLE QUOTATION MARK）和 `"`（U+201D, RIGHT DOUBLE QUOTATION MARK）：

```bash
node -e "
const fs = require('fs');
let raw = fs.readFileSync('json-org/file.json', 'utf-8');
// 定位损坏行，将中文引号的 \" 替换为 Unicode 弯引号
// 注意保留 JSON 字符串真正的结束 \" 
// 例：...在\"环境要求\"...提及\"CANN >= 8.5.0\"\"...
//   → ...在"环境要求"...提及"CANN >= 8.5.0"\"...
raw = raw.replace('损坏的原文', '修复后的原文');
JSON.parse(raw); // 验证修复
fs.writeFileSync('json-org/file.json', raw, 'utf-8');
"
```

**关键**：替换时只替换中文引号位置的那几个 `"`，保留 JSON 字符串定界符的 `"`（通常是该行最后一个 `"` 或倒数第几个需要仔细辨认）。

#### 类型 2：文件中的垃圾字符

**症状**：`JSON.parse()` 报 `Expected double-quoted property name`，位置在某个字段中间。

**原因**：报告生成过程中随机字符串（如 `P3390851`）被插入到 JSON 对象中。

**检测方法**：同样用 `JSON.parse()` 试解析，查看错误位置。

**修复方法**：直接删除垃圾标记行：

```bash
node -e "
let raw = require('fs').readFileSync('file.json','utf-8');
raw = raw.replace('     P3390851\r\n', '');  // 整行删除
JSON.parse(raw);
"
```

#### 类型 3：损坏的 URL

**症状**：`repo_url` 字段包含垃圾字符，如 `gitcodeP3390851com`、`gitcode9cann`。

**修复方法**：根据已知模式恢复。GitCode URL 格式为 `https://gitcode.com/<org>/<repo>.git`。结合 `repo_path` 或文件名推断正确的组织名和仓库名。

#### 类型 4：URL 带附加文本

**症状**：`repo_url` 值为 `https://gitcode.com/cann/ops-nn.git (cloned to /path/to/repo)`。

**修复方法**：在 ` (` 处分割，只保留前半部分 URL。

### 缺少 repo_name
按优先级从多个来源推断：
1. `metadata.repo_name`（显式声明）
2. `repo_info.name`（标准格式）
3. `repo_url` 的末尾路径段（去掉 `.git`）：`https://gitcode.com/cann/amct.git` → `amct`
4. `repo_path` 的最后一个目录名：`/home/.../kudnn` → `kudnn`
5. 如果 repo_url 带有附加文本（如 `url (cloned to /path)`），在 ` (` 处分割，取前一部分

### 缺少 repo_url
来源优先级：`metadata.repo_url` → `repo_info.url` → 如果仅有本地路径，URL 留空（不要捏造）

### 构建产物不是数组
当 `build.artifacts` 是带计数的对象（非列表）时：
```json
{"driver_libraries": 87, "system_libraries": 13, "test_executables": 130}
```
转为描述性数组：
```json
[{"type": "driver_libraries", "count": 87}, ...]
```

### 重复仓库（WSL vs Ubuntu 前缀）
当同一仓库同时存在 `WSL_<repo>` 和 `Ubuntu_<repo>` 两份文件时，优先选 WSL（通常更新/更相关）。同前缀下选日期更新的。

### UT 嵌套子组件处理（重要）

部分原始文件的 UT 数据不是平面结构，而是按组件拆分的命名子对象：

```json
"unit_test": {
  "status": "success",
  "hixl_test": { "total": 290, "passed": 290, "failed": 0, "test_suites": 21 },
  "llm_datadist_test": { "total_sampled": 10, "passed_sampled": 10 }
}
```

或：

```json
"ut": {
  "status": "FAILED",
  "nodemanager_test": { "collected": 5, "passed": 0, "failed": 5 },
  "llt_cpp": { "status": "NOT_RUN" }
}
```

**处理方式：**
1. 先检查 `ut.total`、`ut.passed`、`ut.failed` 等平面字段
2. 如果平面字段全为 0 或不存在，遍历 `ut` 的子键，找到包含 `total`/`collected`/`passed`/`total_sampled` 等计数的命名子对象
3. 聚合：`total` = 各子组件 total/collected/total_sampled 之和，`passed` 同理，`failed` = 各子组件 failed/errors 之和
4. 将子组件详情保留在 `ut.sub_components` 中，格式：`{ "组件名": { total, passed, failed, ... } }`

**常见计数键名变体：**
- `total`、`total_tests`、`total_suites`、`total_runnable`、`collected`、`total_sampled`、`total_discovered`
- `passed`、`passed_tests`、`passed_suites`、`passed_sampled`
- `failed`、`failed_tests`、`failed_suites`、`errors`

**已知需要排除的元数据键（不做为子组件）：**
`status`、`reason`、`note`、`summary`、`duration_seconds`、`failures`、`failure_reason`、`pass_rate`、`skipped`、`test_cases`、`test_suites`、`execution_time_seconds`、`notes`、`errors`、`blocked`、`coverage` 等。

---

## 归一化后验证清单（步骤 8 增强版）

以下验证项来自 2026-06-22 会话中发现的实际 bug，每条都是血的教训。

### 结构完整性

```python
# 9 键必须存在
required_keys = ['metadata','machine_spec','document_reading_summary','execution_log',
    'process_timeline','final_results','documentation_gaps','problems_encountered','session_export_file']
for k in required_keys:
    assert k in data, f"Missing key: {k}"

# final_results 3 个子键
for sub in ['build','ut','sample']:
    assert sub in data['final_results'], f"Missing final_results.{sub}"
```

### v630 字段提取验证（防 Bug 1: 48 文件 static_analysis 丢失）

```python
# static_analysis 和 devcontainer 必须存在于顶层（非空时）
# 飞书刷新和仪表盘只读 data['static_analysis']，不读 data['final_results']['static_analysis']
sa = data.get('static_analysis')
dc = data.get('devcontainer')
# 如果源文件 final_results 中有但顶层为空 → BUG
assert sa is not None, "static_analysis missing from top level"
assert dc is not None, "devcontainer missing from top level"
```

### 时长合理性验证（防 Bug 2: ubs-io 3000s→0）

```python
meta = data['metadata']
dur = meta.get('duration_seconds', 0) or 0
start = meta.get('start_time', '')
end = meta.get('end_time', '')

# 如果有 start/end 但 duration=0，计算时间差填充
if dur == 0 and start != 'unknown' and end != 'unknown':
    # 尝试从 start/end 计算（ISO 8601 格式）
    from datetime import datetime
    try:
        t1 = datetime.fromisoformat(start)
        t2 = datetime.fromisoformat(end)
        calc_dur = int((t2 - t1).total_seconds())
        if calc_dur > 0:
            print(f"WARNING: duration=0 but start-end diff={calc_dur}s, source data lost?")
    except: pass

# build duration 合理性
build = data['final_results']['build']
if build.get('status') == 'success' and (build.get('duration_seconds', 0) or 0) == 0:
    print(f"WARNING: build success but duration=0, check source")
```

### UT 状态语义验证（防 Bug 3: 326 passed → no_tests）

```python
ut = data['final_results']['ut']
ut_status = ut.get('status', '')
ut_total = ut.get('total', 0) or 0
ut_passed = ut.get('passed', 0) or 0

# no_tests 仅当真的没有测试用例时使用
if ut_status == 'no_tests' and ut_total > 0:
    print(f"ERROR: UT status=no_tests but total={ut_total}, should be success/partial_success/failed/not_run")

# not_run 仅用于环境限制
if ut_status == 'not_run' and ut_total > 0 and ut_passed > 0:
    print(f"WARNING: UT not_run but {ut_passed} tests passed, should be partial_success?")

# 状态与数值一致性
if ut_status == 'success' and ut.get('failed', 0) > 0:
    print(f"WARNING: UT status=success but failed={ut.get('failed')}")
```

### pre_commit 双格式冗余（防 Bug 4: 消费者读错路径）

```python
# 归一化输出时，pre_commit 数据既写平铺字段也写 results 子对象
# 确保飞书刷新无论读哪种格式都能取到数据
pc = data.get('static_analysis', {}).get('pre_commit', {})
if pc and pc.get('configured'):
    # 确保有 results 冗余
    if 'results' not in pc:
        pc['results'] = {
            'total': pc.get('total_hooks', 0),
            'passed': pc.get('passed', 0),
            'failed': pc.get('failed', 0),
            'skipped': pc.get('skipped', 0),
        }
```
