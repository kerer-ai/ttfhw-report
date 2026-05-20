---
name: ttfhw-report-normalizer
description: Normalize ttfhw-verify build verification report JSON files into a unified template structure. This skill should be used when handling JSON files in the json/ directory of the ttfhw-report project, when new verification reports arrive in varying formats, when the data-loader fails to correctly parse repo attributes, or when dashboard displays incorrect statuses. Covers format detection, field mapping, status normalization, and corrupted JSON repair.
---

# TTFHW Report JSON Normalizer

Normalize heterogeneous ttfhw-verify build verification reports into a single, consistent JSON structure defined by `assets/report_template.json`.

## When to Use

- When new JSON report files are added to the `json/` directory
- When the dashboard displays incorrect statuses, missing repo names, or broken URLs
- When a report format is not recognized by the data-loader
- After a batch of verification runs produces files in varying formats

## Workflow

### 1. Read the Template

Read `assets/report_template.json` to understand the target structure. Every normalized file MUST contain all 9 top-level keys:

`metadata`, `machine_spec`, `document_reading_summary`, `execution_log`, `process_timeline`, `final_results` (with `build`/`ut`/`sample`), `documentation_gaps`, `problems_encountered`, `session_export_file`

### 2. Read and Understand Each Source File

For each JSON file in `json/`, read it individually. Do NOT apply a blind script. Ask:

- What format is this? (Inspect top-level keys)
- What does each field mean semantically in context?
- What data maps to template fields, under which names?
- What is genuinely missing vs. stored under an unexpected key?

### 3. Detect Format

Classify by top-level key signature. Read `references/normalization_guide.md` for the complete detection table and field-by-field mapping for all 5 formats:

| Format | Signature | Prevalence |
|--------|-----------|------------|
| legacy | `metadata` + `final_results` | ~90% |
| stratovirt | `verification_summary` with inner `build_result` | rare |
| openEuler | `verification_info` | rare |
| shmem | `build_results` + `test_execution_results` | rare |
| manifest | `build_verification` + `unit_tests` | rare |

### 4. Map Fields Flexibly

Apply semantic understanding, not mechanical key matching:

- **repo_name**: Source from `metadata.repo_name`, then `repo_info.name`, then infer from last segment of `repo_url` (strip `.git`). Example: `https://gitcode.com/cann/amct.git` → `amct`. Never leave as a raw filesystem path.

- **repo_url**: Check `metadata.repo_url`, `repo_info.url`. Clean corrupted patterns (`gitcodeP3390851com` → `gitcode.com`). Strip appended text (`url (cloned to /path)` → `url`).

- **Build status**: Map varied strings to 5 standard values (see Section 5).

- **UT fields**: Check multiple key names (`ut`, `unit_test`, `unittest`, `unit_tests`). Check multiple count fields (`total`/`total_tests`/`total_suites`/`collected`).

- **Artifacts**: Can be array of strings, array of objects, or object with counts. Normalize to `[{name, path, size}]` form.

- **Problems**: Source arrays may be named `problems_encountered`, `issues_and_solutions`, or `issues_found`. Map fields: `issue`/`description`/`type` → `problem`, `solution`/`resolution`/`recommendation` → `solution`, `source`/`location` → `source`.

### 5. Normalize Status Values

Convert all status strings to lowercase standard values. For the full mapping table, see `references/normalization_guide.md`.

Core mappings:

| Standard | Source Patterns |
|----------|----------------|
| `success` | success, passed, 通过, completed, SUCCESS, verified |
| `failed` | failed, fail, blocked, error, 失败, executed_but_crashed |
| `partial_success` | partial_success, mostly_passed, success_with_workaround, success_with_failures, PARTIAL_FAILURE, executed_but_functional_fail |
| `not_run` | not_run, skipped, not_executed, not_attempted, not_configured, not_applicable, not_attempted_container_environment |
| `unknown` | Only when genuinely no signal: ctest_no_tests_found, no_tests_available |

### 6. Fix Corrupted Data

Common corruptions found in source files:

- **Chinese quotation marks as ASCII `"`**: Mid-string bare `"` used as Chinese quotes breaks JSON. Replace with Unicode `"` (U+201C) and `"` (U+201D).
- **Junk tokens**: Random strings like `P3390851` inserted mid-file. Remove them.
- **Corrupted URLs**: `gitcodeP3390851com` → `gitcode.com`; `gitcode9cann` → `gitcode.com/cann`.
- **Appended text**: `https://url.git (cloned to /path)` → split and keep URL only.

### 7. Validate

After writing each file, verify:

- All 9 template keys present
- `final_results.build`, `.ut`, `.sample` all exist
- All status values are one of: `success`, `failed`, `partial_success`, `not_run`, `unknown`
- `repo_name` is a short name, not a path
- `repo_url` is a valid URL or empty string
- File parses as valid JSON

### 8. Update data-loader.ts

After normalizing JSON files, ensure `lib/data-loader.ts` stays in sync:

- `normalizeStatus()` is a safety net for edge cases the normalization may have missed
- `normalizeToSummary()` reads URL from `meta.repo_url` (not just `repoInfo.url`)
- `getAllRepoNames()` dedup uses same priority as `loadReportData()` (WSL > Ubuntu, newer date > older)
- Display name comes from `repo_name`, not repo_path

## Core Rules

- **Never fabricate data.** If truly absent, use `"unknown"` (string), `0` (number), `[]` (array).
- **Never remove template fields.** Can add extras, never delete required ones.
- **Preserve original context.** Extra keys like `cann_environment`, `verification_conclusion`, `recommendations` coexist with template fields.
- **Read each file.** Do not blindly script. Understand what the file contains before mapping.
- **Be conservative with `unknown`.** Only when data is genuinely absent. If `repo_name` can be inferred from `repo_url`, do so.

## Resources

### assets/report_template.json

The canonical template. Contains the complete target structure with example values. All normalized files should match this shape.

### references/normalization_guide.md

Comprehensive reference covering: format detection table, field-by-field mapping for all 5 source formats, complete status normalization table, common pitfalls and fixes, and artifact format handling.
