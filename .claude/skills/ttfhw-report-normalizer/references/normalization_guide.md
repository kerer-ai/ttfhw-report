# JSON Normalization Guide for ttfhw-verify Reports

## Template Structure (assets/report_template.json)

The target structure has these top-level keys. Every normalized file MUST contain all of them:

```
metadata          — repo_name, repo_path, repo_url, start_time, end_time, duration_seconds, total_steps
machine_spec      — host_machine, container, image_source
document_reading_summary — architecture, recommended_image, dependencies, build_commands, ut_commands, sample_commands, build_entry, ut_entry
execution_log[]   — {timestamp, command, success, output, error, returncode, duration_estimate?, note?}
process_timeline[] — {timestamp, step, action, result, details{}}
final_results     — build{}, ut{}, sample{}
documentation_gaps[] — string[]
problems_encountered[] — {timestamp, problem, solution, source}
session_export_file — string
```

## Core Principles

1. **Do not fabricate data.** Only reorganize existing data. If a value genuinely does not exist anywhere in the source, use "unknown" for strings, 0 for counts, [] for arrays.
2. **Be flexible with field semantics.** Different formats use different names for the same concept. Map by meaning, not by name.
3. **Can add extra fields beyond the template, but never remove template fields.**
4. **Preserve all original data** — extra keys like `cann_environment`, `verification_conclusion`, `recommendations`, `verdict` can coexist with template fields.
5. **Read each file individually.** Understand its narrative before mapping. Don't blindly apply regex or scripts.

## Source Format Detection

When reading a source JSON, classify by top-level keys:

| Format | Detection Signature | Typical Files |
|--------|-------------------|---------------|
| **legacy** | `metadata` + `final_results` | ~90% of reports |
| **stratovirt** | `verification_summary` alone, with inner `build_result` + `test_result` | stratovirt |
| **openEuler** | `verification_info` top-level key | bishengjdk |
| **manifest** | `build_verification` + `unit_tests` top-level | manifest |
| **shmem** | `build_results` + `test_execution_results` (no `final_results`) | SHMEM |

## Field Mapping by Source Format

### 1. Legacy Format (metadata + final_results)

Already close to template. Key mappings:

**metadata:**
- `repo_name` — source from `metadata.repo_name`, or `repo_info.name`, or infer from last segment of `repo_url` (strip `.git`) or `repo_path` (last directory). Example: `https://gitcode.com/cann/amct.git` → `amct`
- `repo_path` — from `metadata.repo_path`
- `repo_url` — from `metadata.repo_url`. Clean corrupted URLs (e.g., `gitcodeP3390851com` → `gitcode.com`)
- `start_time`, `end_time`, `duration_seconds`, `total_steps` — direct mapping

**machine_spec:** Copy as-is. Host machine, container, and image source info is already well-structured.

**document_reading_summary:**
- Map existing `architecture`, `recommended_image`, `dependencies`, `build_commands`, `ut_commands`, `sample_commands` directly
- **build_entry** — use `build_commands` as source, same value
- **ut_entry** — use `ut_commands` as source, same value
- If `build_commands.value` is an array, join with ` ; `

**execution_log / process_timeline:** Copy as-is from source arrays.

**final_results:**
- `build.status` — normalize to standard value (see Status Normalization below)
- `build.duration_seconds` — from `duration_seconds`
- `build.artifacts` — if array of strings, convert to `[{name, path:"unknown", size:"unknown"}]`. If array of objects, keep structure. If object with counts (e.g., `{driver_libraries: 87}`), convert to `[{type, count}]`.
- `ut.status` — normalize; source from `ut.status` or `unit_test.status` or `unittest.status`
- `ut.total/passed/failed` — from `total/passed/failed`, also check `total_tests/passed_tests/failed_tests`, `total_suites/passed_suites/failed_suites`
- `ut.failures` — from `failures` array or `failed_tests_detail`. Convert strings to `{test_name, reason:"unknown"}`
- `sample.status` — normalize; source from `sample.status` or `samples.status` or `sample_run.status`
- `sample.results` — from `results` array

**documentation_gaps:** Direct copy. If array of objects, extract `issue` or `description` field.

**problems_encountered:** Map to `{timestamp, problem, solution, source}`. Source fields may be named `issue`/`problem`/`description`, `solution`/`resolution`/`recommendation`, `source`/`location`.

### 2. Stratovirt Format

Only has `verification_summary` top-level. Extract from sub-keys:

- `metadata.repo_name` → last segment of `verification_summary.repository` (e.g., `.../stratovirt.git` → `stratovirt`)
- `metadata.repo_path` → `verification_summary.repository`
- `metadata.start_time` → `verification_summary.verification_date`
- `metadata.duration_seconds` → parse `build_result.duration` string ("8m 48s" → 528)
- `machine_spec.host_machine.architecture` → `environment.architecture`
- `machine_spec.container.os` → `environment.os`
- `final_results.build.status` → `build_result.status`: "SUCCESS"→"success", else "failed"
- `final_results.build.artifacts` → from `build_result.output_binary` + `binary_size`
- `final_results.ut.status` → `test_result.status`: "SUCCESS"→"success", "PARTIAL_FAILURE"→"partial_success"
- `final_results.ut.total/passed` → from `test_result.total_tests`/`passed_tests`
- `final_results.ut.failures` → from `test_result.failed_tests` array, with `failure_reason` as reason
- `final_results.sample` → "not_run" (not tested)
- `problems_encountered` → from `issues_encountered` array
- `execution_log` → synthesize from build_result command
- `process_timeline` → synthesize build and test phases

### 3. openEuler Format (bishengjdk)

Has `verification_info`, `execution_environment`, `build_execution`, `unit_tests`, `samples`.

- `metadata.repo_name` → from `verification_info.repository`
- `metadata.start_time` → `verification_info.verification_date`
- `metadata.duration_seconds` → parse `build_execution.build_time` ("00:09:03" → 543)
- `machine_spec.container.os` → `execution_environment.os`
- `machine_spec.image_source.image_name` → `execution_environment.docker_image`
- `final_results.build.status` → map Chinese: "成功"/"已验证"→"success", "失败"→"failed"
- `final_results.ut.status` → prioritize `test_results.status` over outer `ut.status`. Map: "通过"→"success"
- `document_reading_summary.dependencies.value` → `dependency_installation.packages_installed`
- `document_reading_summary.build_commands.value` → `document_analysis.build_command` or `build_configuration.configure_command`
- `problems_encountered` → from `issues_and_solutions`

### 4. SHMEM Format

Has `metadata`, `machine_spec`, `document_reading_summary` already, plus `build_results` and `test_execution_results`.

- `final_results.build.status` → from `build_results.core_library.status` (find first component with status)
- `final_results.build.artifacts` → collect from all `build_results.*.artifacts` and `*.install_package`
- `final_results.ut.status` → from `test_execution_results.unit_test_run.status`, map: "executed_but_functional_fail"→"partial_success"
- `final_results.ut.total/passed/failed` → from `unit_test_run.test_summary`
- `final_results.ut.failures` → from `unit_test_run.failed_tests_detail`
- `final_results.sample` → from `test_execution_results.example_run`
- Keep `cann_environment`, `hardware_check` as extra fields

### 5. Manifest Format

Has `metadata`, `machine_spec`, `document_reading_summary`, `build_verification`, `unit_tests`, `sample_execution`.

- `final_results.build.status` → from `build_verification.overall_build_status`. Map: "blocked"→"failed"
- `final_results.build.blockers` → from `build_verification.blockers`
- `final_results.ut` → from `unit_tests`. "not_configured"→"not_run"
- `final_results.sample` → from `sample_execution`. "not_attempted"→"not_run"
- `execution_log` → synthesize from `build_verification` sub-steps
- `problems_encountered` → from `issues_found` array. Map: `type`/`description`→`problem`, `recommendation`→`solution`

## Status Normalization

Map all status strings to the 5 standard values:

| Standard | Source Patterns |
|----------|----------------|
| **success** | `success`, `passed`, `通过`, `成功`, `completed`, `completed_success`, `verified`, `已验证`, `SUCCESS` |
| **failed** | `failed`, `fail`, `failure`, `blocked`, `error`, `unsuccessful`, `失败`, `executed_but_crashed` |
| **partial_success** | `partial_success`, `partial_failure`, `partial`, `mostly_passed`, `completed_mostly`, `success_with_modifications`, `success_with_workaround`, `success_with_failures`, `executed_but_functional_fail`, `mostly_success`, `PARTIAL_FAILURE` |
| **not_run** | `not_run`, `skipped`, `not_executed`, `not_attempted`, `not_configured`, `not_applicable`, `not_attempted_container_environment`, `not_tested`, `cannot_verify`, `skipped_npu_required` |
| **unknown** | Everything else: `ctest_no_tests_found`, `no_tests_available`, `incomplete`, `artifacts_available` — these genuinely lack clear signal |

## Common Pitfalls & Fixes

### Corrupted JSON
- **Chinese quotation marks as ASCII `"`**: Replace mid-string bare `"` used as Chinese quotes with Unicode curly quotes `"` (U+201C) and `"` (U+201D)
- **Junk characters mid-file** (e.g., `P3390851`): Remove the garbage token
- **Malformed URL** (e.g., `gitcodeP3390851com`): Restore to `gitcode.com` from known patterns

### Missing repo_name
Infer from multiple sources in priority order:
1. `metadata.repo_name` (explicit)
2. `repo_info.name` (standard format)
3. Last path segment of `repo_url` (strip `.git`): `https://gitcode.com/cann/amct.git` → `amct`
4. Last path segment of `repo_path`: `/home/.../kudnn` → `kudnn`
5. If repo_url has appended text (e.g., `url (cloned to /path)`), split on ` (` and use first part

### Missing repo_url
Source from: `metadata.repo_url` → `repo_info.url` → if local path only, URL stays empty (don't fabricate)

### Artifacts Not an Array
When `build.artifacts` is an object with counts (not a list):
```json
{"driver_libraries": 87, "system_libraries": 13, "test_executables": 130}
```
Convert to descriptive array:
```json
[{"type": "driver_libraries", "count": 87}, ...]
```

### Duplicate Repos (WSL vs Ubuntu prefix)
When both `WSL_<repo>` and `Ubuntu_<repo>` files exist for the same repo, prefer WSL (newer/more relevant). If both are same prefix, prefer newer date.
