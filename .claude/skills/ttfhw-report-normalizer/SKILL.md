---
name: ttfhw-report-normalizer
description: 将 json-org/ 目录中新增的 ttfhw-verify 原始验证报告归一化为统一模板结构并放入 json/ 目录，然后清理重建项目。支持两种模式：不带参数全量比对 json-org/ 和 json/ 目录，自动识别新增文件并归一化；传递文件名则仅归一化指定文件。当 json-org/ 中有新增的原始 JSON 文件需要归一化、或需要处理特定验证报告时，应使用此技能。
---

# TTFHW 报告 JSON 归一化

将 `json-org/` 中的原始验证报告归一化为统一模板结构，放入 `json/` 目录，最后清理重建项目。

## 调用方式

### 模式一：全量比对（不带参数）

```
/ttfhw-report-normalizer
```

对比 `json-org/`（原始）和 `json/`（归一化）两个目录的全部文件，通过仓库标识匹配自动识别新增的原始文件，逐个归一化后放入 `json/`，最后清理旧的静态页面并重新构建。

### 模式二：指定文件（带文件名参数）

```
/ttfhw-report-normalizer verification_report_WSL_hcomm_20260520.json
```

仅对 `json-org/` 下指定的**一个**原始文件进行归一化，输出到 `json/` 目录，清理并重新构建。

## 使用场景

- `json-org/` 目录中新增了原始验证报告 JSON 文件
- 需要将原始报告转换为仪表盘可渲染的统一格式
- 新的验证运行产生了不同格式的报告文件

## 工作流程

### 1. 确定待处理文件

**全量比对模式（不带参数）：**

对比 `json-org/` 和 `json/` 两个目录，找出所有新增的原始文件：

- 提取每个文件名去掉 `verification_report_` 前缀和日期后缀后的 **仓库标识**
- 检查 `json/` 中是否存在同仓库标识的归一化文件
- 文件名不一致（不同日期、不同前缀）即视为新增

```bash
# 提取仓库标识并比对
ls json-org/ | sed 's/verification_report_//;s/_\d\{8\}\(_\d\{6\}\)\?\.json$//;s/\.json$//' | sort > /tmp/org_keys.txt
ls json/ | sed 's/verification_report_//;s/_\d\{8\}\(_\d\{6\}\)\?\.json$//;s/\.json$//' | sort > /tmp/norm_keys.txt
comm -23 /tmp/org_keys.txt /tmp/norm_keys.txt
```

根据输出的仓库标识列表，找到 `json-org/` 中对应的完整文件名，逐个处理。

**指定文件模式（带文件名参数）：**

直接对 `json-org/<filename>` 这一个文件进行处理。

### 2. 阅读模板

阅读 `assets/report_template.json` 明确目标结构。归一化后的文件必须包含全部 9 个顶级键：

`metadata`、`machine_spec`、`document_reading_summary`、`execution_log`、`process_timeline`、`final_results`（含 `build`/`ut`/`sample`）、`documentation_gaps`、`problems_encountered`、`session_export_file`

### 3. 逐个阅读并理解新增的源文件

对每个新增的原始 JSON 文件，单独阅读全文。不要用脚本批量处理。理解：

- 这是什么格式？（检查顶级键特征）
- 每个字段在上下文中语义上代表什么？
- 哪些数据能映射到模板字段，以什么键名出现？
- 哪些是真正缺失的，哪些只是存放在意料之外的键名下？

### 4. 检测格式

根据顶级键特征分类。完整映射见 `references/normalization_guide.md`：

| 格式 | 识别特征 |
|--------|-----------|
| legacy | `metadata` + `final_results` |
| stratovirt | 仅有 `verification_summary`，内部含 `build_result` |
| openEuler | `verification_info` 顶级键 |
| shmem | `build_results` + `test_execution_results` |
| manifest | `build_verification` + `unit_tests` 顶级键 |

### 5. 灵活映射字段

基于语义理解进行映射，而非机械的键名匹配：

- **repo_name**：优先 `metadata.repo_name` → `repo_info.name` → 从 `repo_url` 末段推断（去 `.git`）。例：`https://gitcode.com/cann/amct.git` → `amct`。**绝不保留原始文件系统路径。**
- **repo_url**：检查 `metadata.repo_url`、`repo_info.url`。清理损坏 URL。**原始数据没有 URL 时留空，不要把 repo_path 填进去。**
- **start_time/end_time**：检查 `metadata.start_time`/`end_time`，也查 `verification_start`/`verification_end` 等同义字段。
- **构建状态**：映射为 5 种标准值（见第 6 节）
- **UT 字段**：检查多个键名（`ut`、`unit_test`、`unittest`、`unit_tests`）。**平面字段为空时遍历命名子组件聚合，详情保留在 `sub_components` 中**
- **构建产物**：字符串数组转 `[{name, path, size}]`，对象数组保留结构，对象计数转 `[{type, count}]`。**原始数据有 `artifacts_location` 时填入 `path`**
- **问题列表**：源数组可能名为 `problems_encountered`、`issues_and_solutions`、`issues_found`。字段映射：`issue`/`description`/`type` → `problem`，`solution`/`resolution`/`recommendation` → `solution`

### 6. 归一化状态值

将所有状态字符串转为小写标准值：

| 标准值 | 源数据模式 |
|----------|----------------|
| `success` | success、passed、通过、completed、SUCCESS、verified、成功 |
| `failed` | failed、fail、blocked、error、unsuccessful、失败、executed_but_crashed |
| `partial_success` | partial_success、mostly_passed、success_with_workaround、success_with_failures、PARTIAL_FAILURE |
| `not_run` | not_run、skipped、not_executed、not_attempted、not_configured、not_applicable、cannot_build |
| `unknown` | 仅当确实无信号时使用 |

### 7. 修复损坏数据

源文件的 JSON 可能因生成工具缺陷而损坏，导致 `JSON.parse()` 失败。归一化前必须修复。

**检测**：对每个原始文件先用 `JSON.parse()` 测试。如果报错，定位到错误行号，阅读上下文理解损坏原因。

**常见损坏类型及修复：**

- **中文引号变 ASCII `"`**（最常见）：JSON 字符串中间用于中文引用的裸 `"` 会提前结束字符串。定位损坏行，将中文引号对的 `"` 替换为 Unicode `"`（U+201C）和 `"`（U+201D），**保留 JSON 字符串定界符的 `"`**。详细步骤见 `references/normalization_guide.md`

- **垃圾字符**（如 `P3390851`）：直接删除包含垃圾字符的整行

- **损坏 URL**：`gitcodeP3390851com` → `gitcode.com`

- **URL 附加文本**：`url (cloned to /path)` → 仅保留 URL

**修复后验证**：`JSON.parse()` 成功后再继续归一化，避免丢失数据（如之前 AMCT 因原始损坏导致 skipped 数量被错误推断）。

### 8. 验证

写入后验证：

- 9 个模板键全部存在
- `final_results.build`、`.ut`、`.sample` 全部存在
- 所有状态值为标准值之一
- `repo_name` 是简短名称，不是路径
- `repo_url` 是有效 URL 或空字符串（不是本地路径）
- 文件是合法 JSON

### 9. 清理重建项目

归一化完成后，清理并重建：

```bash
rm -rf .next && npm run build
```

### 10. 清理旧文件（可选）

如果同一仓库存在多份归一化报告（不同日期），保留最新的一份，删除旧的。

## 核心原则

- **绝不捏造数据。** 缺失用 `"unknown"`（字符串）、`0`（数字）、`[]`（数组）
- **绝不删除模板字段。** 可增加额外字段，不能删除必需字段
- **保留原始上下文。** `cann_environment`、`verification_conclusion`、`recommendations` 等额外键与模板字段共存
- **逐个阅读每个文件。** 理解内容后再映射，不盲目使用脚本
- **原始数据无 URL 时留空。** 不要把 `repo_path`（本地路径）填入 `repo_url`

## 资源

### assets/report_template.json
标准模板。完整的目标结构及示例值。

### references/normalization_guide.md
详细参考：格式检测表、5 种源格式逐字段映射、状态归一化对照表、常见陷阱与修复。
