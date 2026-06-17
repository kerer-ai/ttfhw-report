/**
 * 将 json/ 目录下所有验证报告归一化为 report_template.json 统一结构。
 *
 * 原则：
 *  - 只重整结构，不捏造数据
 *  - 模板字段一个不少，缺失填 "unknown"（字符串）或 0/[](数值/数组)
 *  - 允许保留原始额外字段（__original 中）
 *  - 同时修复已知的损坏 JSON (amct)
 */

import fs from 'fs'
import path from 'path'

const JSON_DIR = path.join(process.cwd(), 'json')
const TEMPLATE_TOP_KEYS = [
  'metadata', 'machine_spec', 'document_reading_summary',
  'execution_log', 'process_timeline', 'final_results',
  'documentation_gaps', 'problems_encountered', 'session_export_file',
]

// --------------- helpers ---------------

function normStatus(s: any): string {
  if (s === undefined || s === null) return 'unknown'
  const t = String(s).toLowerCase().trim()
  // 成功
  if (t === 'success' || t === 'passed' || t === '通过' || t === '已验证' || t === 'verified' || t === '成功' || t === 'completed' || t === 'completed_success') return 'success'
  // 失败
  if (t === 'failed' || t === 'fail' || t === 'failure' || t === 'unsuccessful' || t === '失败' || t === 'error') return 'failed'
  // 部分成功
  if (t === 'partial_success' || t === 'partial_failure' || t === 'partial' || t === 'incomplete' || t === 'mostly_passed' || t === 'completed_mostly' || t === '部分成功' || t === '部分通过' || t.includes('partial')) return 'partial_success'
  // 无用例 (仓库没有测试/示例)
  if (t === 'not_available' || t === 'no_tests' || t === 'not_applicable') return 'no_tests'
  // 无法执行 / 跳过
  if (t === 'skipped' || t === 'not_run' || t === 'not_executed' || t === 'not_attempted' || t === 'not_configured' || t === 'unknown' || t.includes('not_attempted') || t.includes('not_attempt')) return 'not_run'
  // 中文：无法执行/环境不具备
  if (t.includes('未执行') || t.includes('无法执行') || t.includes('不具备') || t.includes('不能执行')) return 'not_run'
  if (t.includes('executed') && t.includes('fail')) return 'partial_success'
  if (t.includes('success') && t.includes('fail')) return 'partial_success'
  if (t.includes('success') || t.includes('passed')) return 'success'
  if (t.includes('block')) return 'failed'
  if (t.includes('fail')) return 'failed'
  if (t.includes('not') || t.includes('skip')) return 'not_run'
  return 'unknown'
}

// UT 专用状态归一化：结合 total 值判断是否为 no_tests
function normUtStatus(s: any, total?: number): string {
  const base = normStatus(s)
  // 状态缺失且 total=0 或明确 no_tests → 无用例
  if ((!s || s === undefined || s === null) && (total === undefined || total === 0)) return 'no_tests'
  if (base === 'no_tests') return 'no_tests'
  if (base === 'unknown' && (total === undefined || total === 0)) return 'no_tests'
  return base
}

function defStr(v: any): string {
  if (v === undefined || v === null) return 'unknown'
  return String(v)
}

function defNum(v: any): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const n = parseFloat(v); if (Number.isFinite(n)) return n }
  return undefined
}

function defArr(v: any): any[] {
  return Array.isArray(v) ? v : []
}

function defObj(v: any): Record<string, any> {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}
}

// --------------- format detectors ---------------

type Format = 'standard' | 'legacy' | 'stratovirt' | 'openEuler' | 'shmem_v2' | 'manifest' | 'kutacc_v2'

function detectFormat(data: any): Format {
  const keys = Object.keys(data)

  // 已经是标准格式 (meta + build_result)
  if (data.meta && data.build_result) return 'standard'

  // openEuler / bishengjdk
  if (data.verification_info) return 'openEuler'

  // stratovirt: verification_summary 内部有 build_result / test_result
  if (data.verification_summary && (data.verification_summary.build_result || data.verification_summary.test_result)) {
    return 'stratovirt'
  }

  // SHMEM v2: build_results + test_execution_results (无 final_results)
  if (data.build_results && data.test_execution_results && !data.final_results) return 'shmem_v2'

  // manifest: build_verification + unit_tests 顶级键
  if (data.build_verification && data.unit_tests) return 'manifest'

  // kutacc v2: verification_status + build_result + test_results
  if (data.verification_status && data.build_result && data.test_results) return 'kutacc_v2'

  // legacy: metadata + final_results (大多数文件)
  return 'legacy'
}

// --------------- normalizers per format ---------------

function emptyTemplate(): any {
  return {
    metadata: {
      repo_path: 'unknown',
      start_time: 'unknown',
      end_time: 'unknown',
      duration_seconds: 0,
      total_steps: 0,
    },
    machine_spec: {
      host_machine: { architecture: 'unknown', cpu_model: 'unknown', cpu_cores: 0, memory: 'unknown', disk: 'unknown', docker_version: 'unknown' },
      container: { os: 'unknown', architecture: 'unknown', cpu_cores: 0, memory: 'unknown' },
      image_source: { type: 'unknown', image_name: 'unknown', selection_reason: 'unknown' },
    },
    document_reading_summary: {
      architecture: { source: 'unknown', value: 'unknown' },
      recommended_image: { source: 'unknown', value: 'unknown' },
      dependencies: { source: 'unknown', value: [] as string[] },
      build_commands: { source: 'unknown', value: 'unknown' },
      ut_commands: { source: 'unknown', value: 'unknown' },
      sample_commands: { source: 'unknown', value: 'unknown' },
      build_entry: { source: 'unknown', value: 'unknown' },
      ut_entry: { source: 'unknown', value: 'unknown' },
    },
    execution_log: [] as any[],
    process_timeline: [] as any[],
    final_results: {
      static_analysis: { enabled: false, pre_commit: { configured: false, config_file: null }, lint_runner: { configured: false, config_file: null } },
      devcontainer: { enabled: false, config_dir: null, config_files: [] as string[] },
      build: { status: 'unknown', duration_seconds: 0, artifacts: [] as any[] },
      ut: { status: 'unknown', duration_seconds: 0, total: 0, passed: 0, failed: 0, failures: [] as any[] },
      sample: { status: 'unknown', duration_seconds: 0, results: [] as any[] },
    },
    documentation_gaps: [] as string[],
    problems_encountered: [] as any[],
    session_export_file: 'unknown',
  }
}

function mergeMetadata(tmpl: any, src: any) {
  const m = tmpl.metadata
  const s = src.metadata || src.meta || {}
  m.repo_path = defStr(s.repo_path || s.repo_path_original)
  m.repo_name = s.repo_name && s.repo_name !== 'unknown' ? defStr(s.repo_name) : undefined
  // repo_url: prefer explicit URL, then repo_path if it's a URL, then repository_url
  const explicitUrl = s.repo_url || s.repository_url
  const pathAsUrl = (typeof s.repo_path === 'string' && /^https?:\/\//.test(s.repo_path)) ? s.repo_path : undefined
  m.repo_url = defStr(explicitUrl || pathAsUrl)
  m.start_time = defStr(s.start_time || s.generated_at)
  m.end_time = defStr(s.end_time)
  m.duration_seconds = defNum(s.duration_seconds) ?? 0
  m.total_steps = defNum(s.total_steps) ?? (Array.isArray(src.execution_log || src.process_timeline) ? Math.max((src.execution_log || src.process_timeline).length, 0) : 0)
  // v630: preserve new metadata fields
  if (s.branch) m.branch = defStr(s.branch)
  if (s.commit) m.commit = defStr(s.commit)
  if (s.commit_subject) m.commit_subject = defStr(s.commit_subject)
  if (s.commit_date) m.commit_date = defStr(s.commit_date)
  if (s.git_describe) m.git_describe = defStr(s.git_describe)
}

function mergeMachineSpec(tmpl: any, src: any) {
  const ms = src.machine_spec || {}
  const orig = src.__original || src

  // host_machine
  const hm = ms.host_machine || orig.machine_spec?.host_machine || {}
  tmpl.machine_spec.host_machine = {
    architecture: defStr(hm.architecture),
    cpu_model: defStr(hm.cpu_model),
    cpu_cores: defNum(hm.cpu_cores) ?? 0,
    memory: defStr(hm.memory),
    disk: defStr(hm.disk),
    docker_version: defStr(hm.docker_version),
  }

  // container
  const ct = ms.container || orig.machine_spec?.container || {}
  tmpl.machine_spec.container = {
    os: defStr(ct.os),
    architecture: defStr(ct.architecture),
    cpu_cores: defNum(ct.cpu_cores) ?? 0,
    memory: defStr(ct.memory),
  }

  // image_source
  const ims = ms.image_source || ms.image_selection || orig.machine_spec?.image_source || orig.machine_spec?.image_selection || {}
  tmpl.machine_spec.image_source = {
    type: defStr(ims.type),
    image_name: defStr(ims.image_name),
    selection_reason: defStr(ims.selection_reason),
  }
}

function mergeDocSummary(tmpl: any, src: any) {
  const ds = src.document_reading_summary || {}
  const orig = src.__original || src
  const ods = orig.document_reading_summary || {}

  const arch = ds.architecture || ods.architecture || {}
  tmpl.document_reading_summary.architecture = {
    source: defStr(arch.source),
    value: defStr(arch.value),
  }

  const img = ds.recommended_image || ods.recommended_image || {}
  tmpl.document_reading_summary.recommended_image = {
    source: defStr(img.source),
    value: defStr(img.value),
  }

  const deps = ds.dependencies || ods.dependencies || {}
  const depsVal = deps.value
  tmpl.document_reading_summary.dependencies = {
    source: defStr(deps.source),
    value: Array.isArray(depsVal) ? depsVal.map(String) : (typeof depsVal === 'string' ? [depsVal] : []),
  }

  const bld = ds.build_commands || ods.build_commands || {}
  tmpl.document_reading_summary.build_commands = {
    source: defStr(bld.source),
    value: Array.isArray(bld.value) ? bld.value.join(' ; ') : defStr(bld.value),
  }

  const ut = ds.ut_commands || ods.ut_commands || {}
  tmpl.document_reading_summary.ut_commands = {
    source: defStr(ut.source),
    value: Array.isArray(ut.value) ? ut.value.join(' ; ') : defStr(ut.value),
  }

  const smp = ds.sample_commands || ods.sample_commands || {}
  tmpl.document_reading_summary.sample_commands = {
    source: defStr(smp.source),
    value: Array.isArray(smp.value) ? smp.value.join(' ; ') : defStr(smp.value),
  }

  const bentry = ds.build_entry || ods.build_entry || {}
  tmpl.document_reading_summary.build_entry = {
    source: defStr(bentry.source),
    value: defStr(bentry.value),
  }

  const uentry = ds.ut_entry || ods.ut_entry || {}
  tmpl.document_reading_summary.ut_entry = {
    source: defStr(uentry.source),
    value: defStr(uentry.value),
  }
}

function mergeExecutionLog(tmpl: any, src: any) {
  const orig = src.__original || src
  const raw = src.execution_log || orig.execution_log || orig.build_execution_log || []
  if (Array.isArray(raw)) {
    tmpl.execution_log = raw.map((e: any) => ({
      timestamp: defStr(e.timestamp),
      command: defStr(e.command),
      success: e.success !== undefined ? Boolean(e.success) : (e.result === 'success' || e.status === 'success'),
      output: (e.output !== undefined && e.output !== null && e.output !== '')
        ? String(e.output)
        : (e.output_summary !== undefined && e.output_summary !== null && e.output_summary !== '')
          ? String(e.output_summary)
          : '',
      error: (e.error || e.error_message) && (e.error || e.error_message) !== 'unknown' ? defStr(e.error || e.error_message) : '',
      returncode: defNum(e.returncode) ?? (e.success ? 0 : 1),
      duration_seconds: defNum(e.duration_seconds) ?? (e.duration_estimate ? undefined : undefined),
      ...(e.note ? { note: defStr(e.note) } : {}),
    }))
  }
}

function mergeProcessTimeline(tmpl: any, src: any) {
  const orig = src.__original || src
  const raw = src.process_timeline || orig.process_timeline || []
  if (Array.isArray(raw)) {
    tmpl.process_timeline = raw.map((e: any) => ({
      timestamp: defStr(e.timestamp),
      step: defStr(e.step),
      action: defStr(e.action),
      result: defStr(e.result),
      details: e.details || {},
    }))
  }
}

function mergeFinalResults(tmpl: any, src: any) {
  const orig = src.__original || src
  const fr = src.final_results || orig.final_results || {}

  // --- static_analysis (v630) ---
  const sa = fr.static_analysis || {}
  tmpl.final_results.static_analysis = {
    enabled: Boolean(sa.enabled),
    summary: defStr(sa.summary),
    pre_commit: {
      configured: Boolean(sa.pre_commit?.configured),
      config_file: sa.pre_commit?.config_file || null,
      status: defStr(sa.pre_commit?.status),
      duration_seconds: defNum(sa.pre_commit?.duration_seconds) ?? 0,
      total_hooks: defNum(sa.pre_commit?.total_hooks),
      passed: defNum(sa.pre_commit?.passed) ?? 0,
      failed: defNum(sa.pre_commit?.failed) ?? 0,
      skipped: defNum(sa.pre_commit?.skipped) ?? 0,
      failures: Array.isArray(sa.pre_commit?.failures) ? sa.pre_commit.failures : [],
    },
    lint_runner: {
      configured: Boolean(sa.lint_runner?.configured),
      config_file: sa.lint_runner?.config_file || null,
      status: defStr(sa.lint_runner?.status),
      duration_seconds: defNum(sa.lint_runner?.duration_seconds) ?? 0,
      active_linters: Array.isArray(sa.lint_runner?.active_linters) ? sa.lint_runner.active_linters : [],
      result: defStr(sa.lint_runner?.result),
    },
  }

  // --- devcontainer (v630) ---
  const dc = fr.devcontainer || {}
  tmpl.final_results.devcontainer = {
    enabled: Boolean(dc.enabled),
    config_dir: dc.config_dir || null,
    config_files: Array.isArray(dc.config_files) ? dc.config_files : [],
    summary: defStr(dc.summary),
  }

  // --- build ---
  const build = fr.build || {}
  // Merge artifacts from multiple sources: final_results.build.artifacts, build_artifacts top-level
  let buildArtifacts: any[] = build.artifacts || build.artifacts_list || []
  const topBuildArtifacts = orig.build_artifacts || src.build_artifacts
  if (topBuildArtifacts && typeof topBuildArtifacts === 'object' && !Array.isArray(topBuildArtifacts)) {
    // Structured build_artifacts like hcomm: { main_package: {...}, ... }
    for (const v of Object.values(topBuildArtifacts)) {
      if (v && typeof v === 'object') buildArtifacts.push(v)
    }
  }
  // build.command: 优先源数据 command，回退 document_reading_summary.build_commands
  const buildCommand = build.command
    || (Array.isArray(src.document_reading_summary?.build_commands?.value)
        ? src.document_reading_summary.build_commands.value.join(' ; ')
        : src.document_reading_summary?.build_commands?.value)
    || undefined

  tmpl.final_results.build = {
    status: normStatus(build.status),
    duration_seconds: defNum(build.duration_seconds) ?? 0,
    command: buildCommand || undefined,
    concurrency: defNum(build.concurrency),
    duration_breakdown: build.duration_breakdown && typeof build.duration_breakdown === 'object' ? { ...build.duration_breakdown } : undefined,
    artifacts: Array.isArray(buildArtifacts)
      ? buildArtifacts.map((a: any) => {
          if (typeof a === 'string') return { name: a, path: 'unknown', size: 'unknown' }
          return {
            name: defStr(a.name || a.path),
            path: defStr(a.path || a.name),
            size: defStr(a.size || a.size_mb ? `${a.size || a.size_mb}` : 'unknown'),
          }
        })
      : [],
  }

  // --- ut ---
  const ut = fr.ut || fr.unit_test || fr.unittest || fr.unit_tests || {}
  const total = defNum(ut.total || ut.total_tests || ut.total_suites || ut.test_cases) ?? 0
  const passed = defNum(ut.passed || ut.passed_tests || ut.passed_suites) ?? 0
  const failed = defNum(ut.failed || ut.failed_tests || ut.failed_suites) ?? 0
  const failures: any[] = []
  if (Array.isArray(ut.failures)) {
    for (const f of ut.failures) {
      if (typeof f === 'string') failures.push({ test_name: f, reason: 'unknown' })
      else if (typeof f === 'object') failures.push({ test_name: defStr(f.name || f.test_name), reason: defStr(f.reason || f.root_cause || f.note) })
    }
  }
  // Also extract from failed_suites_details / failed_tests_detail
  const failedSuites = ut.failed_suites_details || ut.failed_tests_detail || []
  if (Array.isArray(failedSuites)) {
    for (const f of failedSuites) {
      if (typeof f === 'string') failures.push({ test_name: f, reason: 'unknown' })
      else if (typeof f === 'object') failures.push({
        test_name: defStr(f.name || f.test_name || f.test_suite),
        reason: defStr(f.reason || f.root_cause || f.note),
      })
    }
  }
  // Deduplicate failures
  const seen = new Set()
  const uniqueFailures = failures.filter(f => {
    const k = JSON.stringify(f)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  tmpl.final_results.ut = {
    status: normUtStatus(ut.status, total),
    duration_seconds: defNum(ut.duration_seconds || ut.total_execution_time_seconds || ut.execution_time_seconds) ?? 0,
    total,
    passed,
    failed,
    failures: uniqueFailures,
    skip_reason: defStr(ut.skip_reason),
  }

  // --- sample ---
  const sample = fr.sample || fr.samples || fr.sample_run || fr.examples || {}
  const sampleResults = sample.results || sample.sample_results || []
  const sampleResultsCount = Array.isArray(sampleResults) ? sampleResults.length : 0
  tmpl.final_results.sample = {
    status: normUtStatus(sample.status, sampleResultsCount > 0 ? 1 : 0),
    duration_seconds: defNum(sample.duration_seconds) ?? 0,
    results: Array.isArray(sampleResults)
      ? sampleResults.map((r: any) => ({
          sample_name: defStr(r.sample_name || r.name || r.example_name),
          execution_status: normStatus(r.execution_status || r.status),
          output_summary: defStr(r.output_summary || r.output || r.note),
          execution_time: defStr(r.execution_time || r.duration || r.time),
        }))
      : [],
    smoke_test_after_install: sample.smoke_test_after_install
      ? {
          command: defStr(sample.smoke_test_after_install.command),
          status: defStr(sample.smoke_test_after_install.status),
          interpretation: defStr(sample.smoke_test_after_install.interpretation),
        }
      : undefined,
  }
}

function mergeDocGaps(tmpl: any, src: any) {
  const orig = src.__original || src
  const gaps = src.documentation_gaps || orig.documentation_gaps || []
  tmpl.documentation_gaps = Array.isArray(gaps) ? gaps.map((g: any) => defStr(g)) : []
}

function mergeProblems(tmpl: any, src: any) {
  const orig = src.__original || src
  const raw = src.problems_encountered || orig.problems_encountered || orig.issues_and_solutions || orig.issues_found || []
  if (Array.isArray(raw)) {
    tmpl.problems_encountered = raw.map((p: any) => ({
      timestamp: defStr(p.timestamp || ''),
      problem: defStr(p.problem || p.issue || p.description || p.type),
      solution: defStr(p.solution || p.resolution || p.recommendation),
      source: defStr(p.source || ''),
      ...(p.severity ? { severity: defStr(p.severity) } : {}),
      ...(p.resolved !== undefined ? { resolved: Boolean(p.resolved) } : {}),
    }))
  }
}

// --------------- format-specific converters ---------------

function convertLegacy(data: any): any {
  const tmpl = emptyTemplate()
  const orig = data.__original || data
  // keep original data accessible
  tmpl.__original = data

  mergeMetadata(tmpl, data)
  mergeMachineSpec(tmpl, data)
  mergeDocSummary(tmpl, data)
  mergeExecutionLog(tmpl, data)
  mergeProcessTimeline(tmpl, data)
  mergeFinalResults(tmpl, data)
  mergeDocGaps(tmpl, data)
  mergeProblems(tmpl, data)

  // session_export_file
  tmpl.session_export_file = defStr(data.session_export_file || orig.session_export_file || data.meta?.export_file || 'unknown')

  // 额外字段: 保留原始数据中有用的顶级字段
  const knownTopKeys = new Set([
    'metadata', 'machine_spec', 'document_reading_summary', 'execution_log', 'process_timeline',
    'final_results', 'documentation_gaps', 'problems_encountered', 'session_export_file',
    '__original', 'build_artifacts', 'unit_test_results', 'verification_summary',
    'containerization_notes', 'cann_toolkit_installation', 'build_execution_log',
    'hardware_check', 'cann_environment', 'conclusion', 'verdict', 'recommendations',
  ])
  for (const key of Object.keys(data)) {
    if (!knownTopKeys.has(key) && !TEMPLATE_TOP_KEYS.includes(key)) {
      tmpl[key] = data[key]
    }
  }

  return tmpl
}

function convertStratovirt(data: any): any {
  const tmpl = emptyTemplate()
  tmpl.__original = data

  const vs = data.verification_summary || {}
  const env = vs.environment || {}
  const build = vs.build_result || {}
  const test = vs.test_result || {}

  // metadata
  tmpl.metadata = {
    repo_path: defStr(vs.repository),
    start_time: defStr(vs.verification_date),
    end_time: defStr(vs.verification_date),
    duration_seconds: defNum(parseDuration(build.duration)) ?? 0,
    total_steps: 0,
  }

  // machine_spec
  tmpl.machine_spec = {
    host_machine: { architecture: defStr(env.architecture), cpu_model: 'unknown', cpu_cores: 0, memory: 'unknown', disk: 'unknown', docker_version: 'unknown' },
    container: { os: defStr(env.os), architecture: defStr(env.architecture), cpu_cores: 0, memory: 'unknown' },
    image_source: { type: 'unknown', image_name: 'unknown', selection_reason: 'unknown' },
  }

  // final_results
  const buildArtifacts = build.output_binary ? [{ name: build.output_binary, path: build.output_binary, size: build.binary_size || 'unknown' }] : []
  tmpl.final_results.build = {
    status: build.status === 'SUCCESS' ? 'success' : 'failed',
    duration_seconds: defNum(parseDuration(build.duration)) ?? 0,
    artifacts: buildArtifacts,
  }

  const testStatus = test.status === 'SUCCESS' ? 'success' : test.status === 'PARTIAL_FAILURE' ? 'partial_success' : normStatus(test.status)
  const testFailures = Array.isArray(test.failed_tests)
    ? test.failed_tests.map((t: string) => ({ test_name: t, reason: test.failure_reason || 'unknown' }))
    : []
  tmpl.final_results.ut = {
    status: testStatus,
    duration_seconds: 0,
    total: defNum(test.total_tests) ?? 0,
    passed: defNum(test.passed_tests) ?? 0,
    failed: defNum(test.failed_tests?.length) ?? 0,
    failures: testFailures,
  }

  tmpl.final_results.sample = { status: 'not_run', duration_seconds: 0, results: [] }

  // execution_log
  tmpl.execution_log = [
    { timestamp: defStr(vs.verification_date), command: defStr(build.command), success: build.status === 'SUCCESS', output: build.output_binary || '', error: '', returncode: build.status === 'SUCCESS' ? 0 : 1 },
  ]

  // process_timeline
  tmpl.process_timeline = [
    { timestamp: defStr(vs.verification_date), step: 'build', action: '构建', result: build.status === 'SUCCESS' ? 'success' : 'failed', details: {} },
    { timestamp: defStr(vs.verification_date), step: 'ut_execution', action: '运行单元测试', result: testStatus, details: { total: test.total_tests, passed: test.passed_tests } },
  ]

  // problems
  if (Array.isArray(vs.issues_encountered)) {
    tmpl.problems_encountered = vs.issues_encountered.map((p: any) => ({
      timestamp: defStr(vs.verification_date),
      problem: defStr(p.issue || p.description),
      solution: defStr(p.resolution || ''),
      source: defStr(p.source || ''),
    }))
  }

  if (vs.documentation_gaps) tmpl.documentation_gaps = defArr(vs.documentation_gaps).map(String)
  if (vs.recommendations) tmpl.recommendations = defArr(vs.recommendations)
  if (vs.conclusion) tmpl.conclusion = defStr(vs.conclusion)

  tmpl.session_export_file = 'unknown'
  return tmpl
}

function convertOpenEuler(data: any): any {
  const tmpl = emptyTemplate()
  tmpl.__original = data

  const vi = data.verification_info || {}
  const env = data.execution_environment || {}
  const doc = data.document_analysis || {}
  const deps = data.dependency_installation || {}
  const cfg = data.build_configuration || {}
  const bld = data.build_execution || {}
  const ut = data.unit_tests || {}
  const sample = data.samples || {}
  const result = data.verification_result || {}

  // metadata
  tmpl.metadata = {
    repo_path: defStr(vi.repository || vi.repository_url),
    start_time: defStr(vi.verification_date),
    end_time: defStr(vi.verification_date),
    duration_seconds: defNum(parseTimeString(bld.build_time)) ?? 0,
    total_steps: 0,
  }

  // machine_spec
  tmpl.machine_spec = {
    host_machine: { architecture: defStr(env.architecture), cpu_model: 'unknown', cpu_cores: 0, memory: 'unknown', disk: 'unknown', docker_version: defStr(env.docker_version) },
    container: { os: defStr(env.os || env.docker_image), architecture: defStr(env.architecture), cpu_cores: 0, memory: 'unknown' },
    image_source: { type: 'base_image', image_name: defStr(env.docker_image), selection_reason: defStr(env.container_name) },
  }

  // document_reading_summary
  tmpl.document_reading_summary = {
    architecture: { source: 'unknown', value: defStr(env.architecture) },
    recommended_image: { source: 'unknown', value: defStr(env.docker_image) },
    dependencies: { source: 'document_analysis', value: Array.isArray(deps.packages_installed) ? deps.packages_installed.map(String) : [] },
    build_commands: { source: 'document_analysis', value: defStr(doc.build_command || cfg.configure_command) },
    ut_commands: { source: 'document_analysis', value: defStr(doc.test_command) },
    sample_commands: { source: 'document_analysis', value: defStr(doc.sample_command) },
    build_entry: { source: 'unknown', value: 'unknown' },
    ut_entry: { source: 'unknown', value: 'unknown' },
  }

  // final_results
  const buildDur = defNum(parseTimeString(bld.build_time)) ?? 0
  tmpl.final_results.build = {
    status: normStatus(bld.status),
    duration_seconds: buildDur,
    artifacts: bld.build_output ? [{ name: defStr(bld.build_output), path: 'unknown', size: 'unknown' }] : [],
  }

  const utResults = ut.test_results || {}
  // Prefer nested test_results.status (typically more specific, e.g. "通过") over outer ut.status
  const utStatusSrc = utResults.status || utResults.overall_status || ut.status
  const totalTests = defNum(utResults.total) ?? defNum(ut.total_tests) ?? 0
  const passedTests = defNum(utResults.passed) ?? defNum(ut.passed_tests) ?? 0
  const failedTests = defNum(utResults.failed) ?? defNum(ut.failed_tests) ?? 0
  tmpl.final_results.ut = {
    status: normUtStatus(utStatusSrc, totalTests),
    duration_seconds: 0,
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    failures: [],
  }

  const sampleResults = sample.results || sample.sample_results || []
  const sampleResultCount = Array.isArray(sampleResults) ? sampleResults.length : 0
  tmpl.final_results.sample = {
    status: normUtStatus(sample.status, sampleResultCount > 0 ? 1 : 0),
    duration_seconds: 0,
    results: Array.isArray(sampleResults) ? sampleResults.map((r: any) => ({
      sample_name: defStr(r.name || r.sample_name),
      execution_status: normStatus(r.status),
      output_summary: defStr(r.output || r.note),
      execution_time: defStr(r.execution_time || r.duration),
    })) : [],
  }

  // execution_log / process_timeline
  const log: any[] = []
  if (env.docker_image) log.push({ timestamp: defStr(vi.verification_date), command: `docker run ${env.container_name || ''} ${env.docker_image}`, success: true, output: `${env.os} ${env.architecture}`, error: '', returncode: 0 })
  if (deps.packages_installed?.length) log.push({ timestamp: defStr(vi.verification_date), command: `install deps: ${deps.packages_installed.slice(0,5).join(', ')}`, success: deps.status === '成功', output: `${deps.packages_installed.length} packages`, error: '', returncode: 0 })
  if (cfg.configure_command) log.push({ timestamp: defStr(vi.verification_date), command: cfg.configure_command, success: cfg.status === '成功', output: cfg.configure_output?.configuration_name || '', error: '', returncode: 0 })
  if (bld.build_time) log.push({ timestamp: defStr(vi.verification_date), command: 'make', success: bld.status === '成功', output: `Duration: ${bld.build_time}`, error: '', returncode: 0 })
  if (ut.test_results) log.push({ timestamp: defStr(vi.verification_date), command: 'make test', success: utResults.status === '通过', output: utResults.sample_test || '', error: '', returncode: 0 })
  tmpl.execution_log = log

  tmpl.process_timeline = log.map((e, i) => ({
    timestamp: e.timestamp,
    step: ['container_setup', 'dependency_installation', 'build', 'build', 'ut_execution'][i] || 'unknown',
    action: e.command,
    result: e.success ? 'success' : 'failed',
    details: {},
  }))

  // problems
  if (Array.isArray(data.issues_and_solutions)) {
    tmpl.problems_encountered = data.issues_and_solutions.map((p: any) => ({
      timestamp: defStr(vi.verification_date),
      problem: defStr(p.issue),
      solution: defStr(p.solution),
      source: defStr(p.source || ''),
      resolved: p.status === '已解决',
    }))
  }

  if (data.recommendations) tmpl.recommendations = defArr(data.recommendations)
  if (result.conclusion) tmpl.conclusion = defStr(result.conclusion)
  tmpl.session_export_file = 'unknown'
  return tmpl
}

function convertShmemV2(data: any): any {
  // SHMEM: Has metadata, machine_spec, doc_summary already, plus build_results + test_execution_results
  const tmpl = emptyTemplate()
  tmpl.__original = data

  mergeMetadata(tmpl, data)
  mergeMachineSpec(tmpl, data)
  mergeDocSummary(tmpl, data)
  mergeExecutionLog(tmpl, data)
  mergeProcessTimeline(tmpl, data)
  mergeDocGaps(tmpl, data)
  mergeProblems(tmpl, { ...data, problems_encountered: data.problems_encountered || data.problems_encountered_and_solutions })

  // Build from build_results (find the first component with status)
  const br = data.build_results || {}
  const buildComponents = Object.values(br).filter((v: any) => v && typeof v === 'object' && v.status)
  const mainBuild = buildComponents.length > 0 ? buildComponents[0] as any : {}
  const allArtifacts: any[] = []
  for (const comp of buildComponents) {
    const c = comp as any
    if (Array.isArray(c.artifacts)) allArtifacts.push(...c.artifacts)
    if (c.install_package) allArtifacts.push(c.install_package)
  }

  tmpl.final_results.build = {
    status: normStatus(mainBuild.status),
    duration_seconds: defNum(mainBuild.duration_seconds) ?? 0,
    artifacts: allArtifacts.map((a: any) => ({
      name: defStr(a.name || a.path),
      path: defStr(a.path || a.name),
      size: defStr(a.size || a.size_mb || 'unknown'),
    })),
  }

  // UT from test_execution_results
  const ter = data.test_execution_results || {}
  const utRun = ter.unit_test_run || ter.unit_tests || {}
  const testSummary = utRun.test_summary || utRun || {}
  const totalTests = defNum(testSummary.total_tests) ?? 0
  const passedTests = defNum(testSummary.passed_tests) ?? 0
  const failedTests = defNum(testSummary.failed_tests) ?? 0

  const failures: any[] = []
  const failedDetail = utRun.failed_tests_detail || utRun.failed_tests || []
  if (Array.isArray(failedDetail)) {
    for (const f of failedDetail) {
      if (typeof f === 'string') failures.push({ test_name: f, reason: 'unknown' })
      else if (typeof f === 'object') {
        if (f.failed_count !== undefined && f.test_suite) {
          failures.push({ test_name: f.test_suite, reason: defStr(f.root_cause), failed_count: f.failed_count })
        } else {
          failures.push({ test_name: defStr(f.test_name || f.test_suite), reason: defStr(f.root_cause || f.reason || f.note) })
        }
      }
    }
  }

  tmpl.final_results.ut = {
    status: normUtStatus(utRun.status, totalTests),
    duration_seconds: defNum(testSummary.execution_time_seconds || utRun.execution_time_seconds) ?? 0,
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    failures,
  }

  // Samples: check for sample_execution results
  const sampleRun = ter.sample_execution || ter.samples || {}
  tmpl.final_results.sample = {
    status: normStatus(sampleRun.status),
    duration_seconds: defNum(sampleRun.duration_seconds) ?? 0,
    results: [],
  }

  // Keep verification_summary data
  if (data.verification_summary) {
    tmpl.verification_summary = data.verification_summary
    if (data.verification_summary.conclusion) tmpl.conclusion = defStr(data.verification_summary.conclusion)
  }

  tmpl.session_export_file = defStr(data.session_export_file || 'unknown')
  return tmpl
}

function convertManifest(data: any): any {
  const tmpl = emptyTemplate()
  tmpl.__original = data

  mergeMetadata(tmpl, data)
  mergeMachineSpec(tmpl, data)
  mergeDocSummary(tmpl, data)
  mergeDocGaps(tmpl, data)
  mergeProblems(tmpl, { ...data, problems_encountered: data.problems_encountered || data.issues_found })

  const bv = data.build_verification || {}
  const bt = data.unit_tests || {}
  const smp = data.sample_execution || {}
  const conclusion = data.conclusion || {}

  // Build
  const buildStatus = normStatus(bv.overall_build_status || conclusion.overall_status)
  tmpl.final_results.build = {
    status: buildStatus,
    duration_seconds: defNum(data.metadata?.duration_seconds) ?? 0,
    artifacts: [],
  }

  // UT
  const utTotal = defNum(bt.total_tests) ?? 0
  const utPassed = defNum(bt.passed) ?? 0
  const utFailed = defNum(bt.failed) ?? 0
  tmpl.final_results.ut = {
    status: normStatus(bt.status),
    duration_seconds: defNum(bt.test_duration_seconds) ?? 0,
    total: utTotal,
    passed: utPassed,
    failed: utFailed,
    failures: [],
  }

  // Sample
  const sampleStatus = smp.status === 'not_attempted' ? 'not_run' : normStatus(smp.status)
  tmpl.final_results.sample = {
    status: sampleStatus,
    duration_seconds: defNum(smp.duration_seconds) ?? 0,
    results: [],
  }

  // execution_log / process_timeline from build_verification sub-steps
  const buildAttempts: any[] = []
  const timelinePhases: any[] = []
  let seq = 1
  for (const [key, val] of Object.entries(bv)) {
    if (key === 'overall_build_status') continue
    if (typeof val === 'object' && val !== null && 'status' in val) {
      const v = val as any
      buildAttempts.push({
        timestamp: defStr(data.metadata?.start_time),
        command: key,
        success: normStatus(v.status) === 'success',
        output: defStr(v.output || v.error),
        error: defStr(v.error || v.root_cause),
        returncode: normStatus(v.status) === 'success' ? 0 : 1,
      })
      timelinePhases.push({
        timestamp: defStr(data.metadata?.start_time),
        step: key,
        action: key,
        result: normStatus(v.status),
        details: {},
      })
      seq++
    }
  }
  if (Object.keys(bt).length > 0) {
    buildAttempts.push({
      timestamp: defStr(data.metadata?.start_time),
      command: 'unit_test',
      success: normStatus(bt.status) === 'success',
      output: `${utPassed}/${utTotal} passed`,
      error: '',
      returncode: normStatus(bt.status) === 'success' ? 0 : 1,
    })
    timelinePhases.push({
      timestamp: defStr(data.metadata?.start_time),
      step: 'ut_execution',
      action: '运行单元测试',
      result: normStatus(bt.status),
      details: { total: utTotal, passed: utPassed },
    })
  }

  if (buildAttempts.length > 0) tmpl.execution_log = buildAttempts
  if (timelinePhases.length > 0) tmpl.process_timeline = timelinePhases

  tmpl.session_export_file = 'unknown'
  return tmpl
}

function convertKutaccV2(data: any): any {
  const tmpl = emptyTemplate()
  tmpl.__original = data

  mergeMetadata(tmpl, data)
  mergeMachineSpec(tmpl, data)
  mergeDocSummary(tmpl, data)
  mergeExecutionLog(tmpl, data)
  mergeProcessTimeline(tmpl, data)
  mergeDocGaps(tmpl, data)
  mergeProblems(tmpl, { ...data, problems_encountered: data.problems_encountered || data.workarounds_applied || data.limitations })

  const br = data.build_result || {}
  const tr = data.test_results || {}
  const conclusion = data.conclusion || {}

  // Build
  const buildArtifacts = br.installed_binaries?.map((b: string) => ({ name: b, path: 'unknown', size: 'unknown' }))
    || (br.output ? [{ name: br.output, path: 'unknown', size: br.size_bytes ? String(br.size_bytes) : 'unknown' }] : [])
  tmpl.final_results.build = {
    status: normStatus(br.status),
    duration_seconds: 0,
    artifacts: buildArtifacts,
  }

  // UT from test_results sub-components
  const testComponents = Object.entries(tr)
    .filter(([, v]) => typeof v === 'object' && v !== null && ('total_tests' in (v as any)))
    .map(([, v]) => v as any)

  const totalTests = testComponents.reduce((s: number, c: any) => s + (c.total_tests || 0), 0)
  const passedTests = testComponents.reduce((s: number, c: any) => s + (c.passed_tests || 0), 0)
  const failedTests = testComponents.reduce((s: number, c: any) => s + (c.failed_tests || 0), 0)

  let utStatus: string
  if (totalTests === 0) utStatus = 'no_tests'
  else if (failedTests === 0) utStatus = 'success'
  else if (passedTests > 0) utStatus = 'partial_success'
  else utStatus = 'failed'

  tmpl.final_results.ut = {
    status: utStatus,
    duration_seconds: 0,
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    failures: [],
  }

  tmpl.final_results.sample = { status: 'not_run', duration_seconds: 0, results: [] }
  tmpl.session_export_file = 'unknown'
  return tmpl
}

// --------------- time parsing helpers ---------------

function parseDuration(dur: string | undefined): number | undefined {
  if (!dur) return undefined
  let total = 0
  const minMatch = dur.match(/(\d+)\s*m/)
  if (minMatch) total += parseInt(minMatch[1]) * 60
  const secMatch = dur.match(/(\d+)\s*s/)
  if (secMatch) total += parseInt(secMatch[1])
  return total > 0 ? total : undefined
}

function parseTimeString(timeStr: string | undefined): number | undefined {
  if (!timeStr) return undefined
  const hms = timeStr.match(/(\d{2}):(\d{2}):(\d{2})/)
  if (hms) return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3])
  return parseDuration(timeStr)
}

// --------------- main ---------------

function normalizeFile(filePath: string): { success: boolean; name: string; format: string; error?: string } {
  const name = path.basename(filePath)
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    let data: any
    try {
      data = JSON.parse(raw)
    } catch (parseErr: any) {
      // 尝试修复常见 JSON 错误: 缺少逗号
      console.warn(`  [WARN] ${name}: JSON parse error, attempting repair: ${parseErr.message}`)
      data = attemptJsonRepair(raw, filePath)
    }

    // Re-process from __original if available (to pick up converter fixes on re-run)
    const sourceData = data.__original || data
    const format = detectFormat(sourceData)
    let normalized: any

    switch (format) {
      case 'standard': normalized = sourceData; break // already standard
      case 'legacy': normalized = convertLegacy(sourceData); break
      case 'stratovirt': normalized = convertStratovirt(sourceData); break
      case 'openEuler': normalized = convertOpenEuler(sourceData); break
      case 'shmem_v2': normalized = convertShmemV2(sourceData); break
      case 'manifest': normalized = convertManifest(sourceData); break
      case 'kutacc_v2': normalized = convertKutaccV2(sourceData); break
      default: throw new Error(`Unknown format: ${format}`)
    }

    // Validate template keys exist
    for (const key of TEMPLATE_TOP_KEYS) {
      if (!(key in normalized)) {
        console.warn(`  [WARN] ${name}: missing template key '${key}', adding default`)
        normalized[key] = emptyTemplate()[key]
      }
    }

    // Write back
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf-8')
    return { success: true, name, format }
  } catch (err: any) {
    return { success: false, name, format: 'unknown', error: err.message }
  }
}

function attemptJsonRepair(raw: string, filePath: string): any {
  // Try common repairs:
  // 1. Missing comma before newline+quote in arrays
  let repaired = raw
    .replace(/\"\s*\n\s*\"/g, '",\n"')  // missing comma between array string elements
    .replace(/(\d)\s*\n\s*\"/g, '$1,\n"') // missing comma after number before string

  try {
    return JSON.parse(repaired)
  } catch {
    // 2. Try more aggressive repair
    repaired = raw
      .replace(/([^,\[\{\s])\s*\n\s*([\"\{\[\\-]|\d)/g, '$1,\n$2')
    try {
      return JSON.parse(repaired)
    } catch (e2: any) {
      throw new Error(`Cannot repair JSON: ${e2.message}`)
    }
  }
}

// --------------- run ---------------

function main() {
  const files = fs.readdirSync(JSON_DIR)
    .filter(f => f.endsWith('.json') && !f.includes('_summary') && !f.startsWith('.'))
    .sort()

  console.log(`Found ${files.length} JSON files to normalize\n`)

  const results: { name: string; format: string; success: boolean; error?: string }[] = []
  for (const file of files) {
    const filePath = path.join(JSON_DIR, file)
    const result = normalizeFile(filePath)
    results.push(result)
    const status = result.success ? 'OK' : 'FAIL'
    console.log(`  [${status}] ${result.name} (format: ${result.format})${result.error ? ' — ' + result.error : ''}`)
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`)

  if (failed > 0) {
    console.log('\nFailed files:')
    results.filter(r => !r.success).forEach(r => console.log(`  - ${r.name}: ${r.error}`))
  }
}

main()
