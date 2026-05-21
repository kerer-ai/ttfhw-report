---
name: ttfhw-report-normalizer
description: 将 ttfhw-verify 构建验证报告的 JSON 文件归一化为统一的模板结构。当处理 json/ 目录下的 JSON 文件、新的验证报告以不同格式到达、data-loader 无法正确解析仓库属性、或仪表盘显示状态不正确时，应使用此技能。覆盖格式检测、字段映射、状态归一化和损坏 JSON 修复。
---

# TTFHW 报告 JSON 归一化

将异构的 ttfhw-verify 构建验证报告归一化为 `assets/report_template.json` 定义的统一 JSON 结构。

## 使用场景

- 新的 JSON 报告文件被添加到 `json/` 目录时
- 仪表盘显示的状态不正确、仓库名缺失或 URL 损坏时
- 报告格式不被 data-loader 识别时
- 一批验证运行产生了不同格式的文件后

## 工作流程

### 1. 阅读模板

阅读 `assets/report_template.json` 理解目标结构。每个归一化后的文件必须包含全部 9 个顶级键：

`metadata`、`machine_spec`、`document_reading_summary`、`execution_log`、`process_timeline`、`final_results`（含 `build`/`ut`/`sample`）、`documentation_gaps`、`problems_encountered`、`session_export_file`

### 2. 逐个阅读并理解源文件

对于 `json/` 目录下的每个 JSON 文件，单独阅读。不要用脚本盲目批量处理。思考以下问题：

- 这是什么格式？（检查顶级键）
- 上下文中每个字段语义上代表什么？
- 哪些数据能映射到模板字段，以什么键名出现？
- 哪些是真正缺失的，哪些只是存放在意料之外的键名下？

### 3. 检测格式

根据顶级键特征分类。完整的格式检测表和逐字段映射见 `references/normalization_guide.md`：

| 格式 | 识别特征 | 占比 |
|--------|-----------|------------|
| legacy | `metadata` + `final_results` | ~90% |
| stratovirt | 仅有 `verification_summary`，内部含 `build_result` | 极少 |
| openEuler | `verification_info` 顶级键 | 极少 |
| shmem | `build_results` + `test_execution_results` | 极少 |
| manifest | `build_verification` + `unit_tests` 顶级键 | 极少 |

### 4. 灵活映射字段

基于语义理解进行映射，而非机械的键名匹配：

- **repo_name**：优先从 `metadata.repo_name`，其次 `repo_info.name`，再次从 `repo_url` 末尾路径段推断（去掉 `.git`）。例如：`https://gitcode.com/cann/amct.git` → `amct`。绝不能保留原始文件系统路径。

- **repo_url**：检查 `metadata.repo_url`、`repo_info.url`。清理损坏的模式（`gitcodeP3390851com` → `gitcode.com`）。去除附加文本（`url (cloned to /path)` → 仅保留 `url`）。

- **构建状态**：将各种字符串映射为 5 种标准值（见第 5 节）。

- **UT 字段**：检查多个键名（`ut`、`unit_test`、`unittest`、`unit_tests`）。检查多个计数字段（`total`/`total_tests`/`total_suites`/`collected`）。**如果平面字段为空，遍历命名子组件（如 `hixl_test`、`nodemanager_test`）聚合计数，并将详情保留在 `sub_components` 中。**

- **构建产物**：可能是字符串数组、对象数组或带计数的对象。统一归一化为 `[{name, path, size}]` 形式。

- **问题列表**：源数据数组可能名为 `problems_encountered`、`issues_and_solutions` 或 `issues_found`。字段映射：`issue`/`description`/`type` → `problem`，`solution`/`resolution`/`recommendation` → `solution`，`source`/`location` → `source`。

### 5. 归一化状态值

将所有状态字符串转换为小写标准值。完整映射表见 `references/normalization_guide.md`。

核心映射：

| 标准值 | 源数据模式 |
|----------|----------------|
| `success` | success、passed、通过、completed、SUCCESS、verified、成功、已验证 |
| `failed` | failed、fail、blocked、error、unsuccessful、失败、executed_but_crashed |
| `partial_success` | partial_success、mostly_passed、success_with_workaround、success_with_failures、PARTIAL_FAILURE、executed_but_functional_fail、部分成功 |
| `not_run` | not_run、skipped、not_executed、not_attempted、not_configured、not_applicable、not_attempted_container_environment |
| `unknown` | 仅在确实无信号时使用：ctest_no_tests_found、no_tests_available 等 |

### 6. 修复损坏数据

源文件中常见的损坏类型：

- **中文引号变成 ASCII `"`**：JSON 字符串中间用于中文引用的裸 `"` 会破坏 JSON 结构。替换为 Unicode 弯引号 `"`（U+201C）和 `"`（U+201D）。
- **垃圾字符**：文件中部插入的随机字符串（如 `P3390851`）。直接删除。
- **损坏的 URL**：`gitcodeP3390851com` → `gitcode.com`；`gitcode9cann` → `gitcode.com/cann`。
- **URL 带附加文本**：`https://url.git (cloned to /path)` → 分割后仅保留 URL 部分。

### 7. 验证

写入每个文件后，验证以下内容：

- 全部 9 个模板键存在
- `final_results.build`、`.ut`、`.sample` 全部存在
- 所有状态值为以下之一：`success`、`failed`、`partial_success`、`not_run`、`unknown`
- `repo_name` 是简短名称，不是路径
- `repo_url` 是有效 URL 或空字符串
- 文件是合法的 JSON

### 8. 同步更新 data-loader.ts

归一化 JSON 文件后，确保 `lib/data-loader.ts` 保持一致：

- `normalizeStatus()` 作为安全网，处理归一化可能遗漏的边界情况
- `normalizeToSummary()` 从 `meta.repo_url` 读取 URL（不仅仅是 `repoInfo.url`）
- `getAllRepoNames()` 去重使用与 `loadReportData()` 相同的优先级（WSL > Ubuntu，日期越新越优先）
- 显示名称使用 `repo_name`，而非 `repo_path`

## 核心原则

- **绝不捏造数据。** 如果数据确实不存在，字符串用 `"unknown"`，数字用 `0`，数组用 `[]`。
- **绝不删除模板字段。** 可以增加额外字段，但绝不能删除必需的字段。
- **保留原始上下文。** 额外键如 `cann_environment`、`verification_conclusion`、`recommendations` 可与模板字段共存。
- **逐个阅读每个文件。** 不要盲目使用脚本。在映射之前理解文件内容。
- **谨慎使用 `unknown`。** 仅当数据确实不存在时才使用。如果 `repo_name` 能从 `repo_url` 推断，就应该推断出来。

## 资源

### assets/report_template.json

标准模板。包含完整的目标结构及示例值。所有归一化文件应匹配此结构。

### references/normalization_guide.md

详细参考文档，涵盖：格式检测表、全部 5 种源格式的逐字段映射、完整状态归一化对照表、常见陷阱与修复方法、产物格式处理。
