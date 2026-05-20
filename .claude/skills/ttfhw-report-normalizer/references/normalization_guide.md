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
- `ut.total/passed/failed` — 来自 `total/passed/failed`，同时检查 `total_tests/passed_tests/failed_tests`、`total_suites/passed_suites/failed_suites`
- `ut.failures` — 来自 `failures` 数组或 `failed_tests_detail`。字符串转为 `{test_name, reason:"unknown"}`
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

### JSON 损坏
- **中文引号变成 ASCII `"`**：JSON 字符串中间用于中文引用的裸 `"` 字符会提前结束字符串。替换为 Unicode 弯引号 `"`（U+201C）和 `"`（U+201D）
- **文件中的垃圾字符**（如 `P3390851`）：直接删除该垃圾标记
- **损坏的 URL**（如 `gitcodeP3390851com`）：根据已知模式恢复为 `gitcode.com`

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
