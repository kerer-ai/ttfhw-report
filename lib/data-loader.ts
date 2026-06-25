import fs from 'fs'
import path from 'path'
import { RepoSummary, RepoDetail, Attempt, BuildResult, UtStats, TimelinePhase, DocumentationChecklist, DependencyInfo, HardwareConfig, ImageSelection, SummaryStats, Artifact, Dependency, MissingDependency, ResultStatus, ConfigStatus } from './types'
import { deriveRepoIdentity, normalizeRepoName } from './utils'

const JSON_DIR = path.join(process.cwd(), 'json')

// ======================== Repo Name Resolution ========================

export function getAllRepoNames(): string[] {
  const seen = new Map<string, { rawName: string; score: number }>()
  const entries = fs.readdirSync(JSON_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json') && !dirent.name.includes('_summary'))

  for (const dirent of entries) {
    const rawName = dirent.name
      .replace('verification_report_', '')
      .replace('.json', '')
      // Strip date suffix: _YYYYMMDD or _YYYYMMDD_HHMMSS
      .replace(/_\d{8}(?:_\d{6})?$/, '')
      .replace(/_final$/, '')
    const key = normalizeRepoName(rawName).toLowerCase().replace(/[-_]/g, '-')

    // 同一仓库多份文件时，选优先级最高的（WSL > Ubuntu，日期越新越好）
    let score = 0
    if (dirent.name.startsWith('verification_report_WSL_')) score += 2000
    else if (dirent.name.startsWith('verification_report_Ubuntu_')) score += 1000
    const dateMatch = dirent.name.match(/_(\d{8})(?:_\d{6})?\.json$/)
    if (dateMatch) score += parseInt(dateMatch[1], 10)

    const existing = seen.get(key)
    if (!existing || score > existing.score) {
      seen.set(key, { rawName, score })
    }
  }
  return [...seen.values()].map(v => v.rawName).sort()
}

// ======================== Data Loading ========================

function loadReportData(repoName: string): any {
  const allFiles = fs.readdirSync(JSON_DIR)
    .filter(f => f.endsWith('.json') && !f.includes('_summary'))

  const candidates: { file: string; score: number }[] = []

  for (const filename of allFiles) {
    const rawName = filename
      .replace('verification_report_', '')
      .replace(/^UBSCore-[^_]+_/, '')
      .replace('.json', '')
      .replace(/_\d{8}(?:_\d{6})?$/, '')
      .replace(/_final$/, '')

    if (normalizeRepoName(rawName).toLowerCase().replace(/[-_]/g, '-') ===
        normalizeRepoName(repoName).toLowerCase().replace(/[-_]/g, '-')) {
      let score = 0
      if (filename.startsWith('verification_report_WSL_')) score += 2000
      else if (filename.startsWith('verification_report_Ubuntu_')) score += 1000

      const dateMatch = filename.match(/_(\d{8})(?:_\d{6})?\.json$/)
      if (dateMatch) score += parseInt(dateMatch[1], 10)

      candidates.push({ file: filename, score })
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  if (candidates.length > 0) {
    const reportPath = path.join(JSON_DIR, candidates[0].file)
    const rawData = fs.readFileSync(reportPath, 'utf-8')
    return JSON.parse(rawData)
  }

  throw new Error(`Report not found for ${repoName}`)
}

// ======================== Summary ========================

export function getAllRepoSummaries(): RepoSummary[] {
  const repos = getAllRepoNames()
  return repos.map(name => {
    try {
      const data = loadReportData(name)
      return normalizeToSummary(name, data)
    } catch (e) {
      const identity = deriveRepoIdentity({ fallbackName: name })
      return {
        name, displayName: identity.repoName || name,
        result: 'unknown', buildStatus: 'unknown', utStatus: 'unknown', sampleStatus: 'unknown',
        totalDuration: 0, environmentDuration: undefined, buildDuration: undefined,
        utDuration: undefined, sampleDuration: undefined,
        testPassed: 0, testFailed: 0, testTotal: undefined, testSkipped: undefined,
        generatedAt: 'N/A', environment: 'unknown', url: identity.url, category: identity.community,
        preCommitStatus: 'unknown', lintRunnerStatus: 'unknown', devcontainerStatus: 'unknown',
      }
    }
  })
}

export function getRepoDetail(repoName: string): RepoDetail | null {
  try {
    const data = loadReportData(repoName)
    return normalizeToDetail(repoName, data)
  } catch (e) {
    return null
  }
}

// ======================== Normalization ========================

function normalizeToSummary(name: string, data: any): RepoSummary {
  const meta = data.metadata || {}
  const build = data.final_results?.build || {}
  const ut = data.final_results?.ut || {}
  const sample = data.final_results?.sample || {}
  const repoInfo = data.repo_info || {}
  const origMeta = data.__original?.metadata
  const repoUrl = (meta.repo_url && meta.repo_url !== 'unknown') ? meta.repo_url
    : (repoInfo.url && repoInfo.url !== 'unknown') ? repoInfo.url
    : (meta.repo_path && /^https?:\/\//.test(meta.repo_path)) ? meta.repo_path
    : undefined
  // 有效的仓库名（过滤占位符）
  const effectiveRepoName = [repoInfo.name, meta.repo_name, origMeta?.repo_name]
    .find((n: string | undefined) => n && n !== 'unknown')
  const identity = deriveRepoIdentity({
    fallbackName: name,
    repoPath: meta.repo_path,
    repoUrl: repoUrl,
    repoInfoName: effectiveRepoName,
    repoInfoUrl: repoUrl,
  })

  const buildStatus = normalizeStatus(build.status)
  const utStatus = normalizeStatus(ut.status)
  const sampleStatus = normalizeStatus(sample.status)

  const testTotal = defNum(ut.total)
  const testPassed = defNum(ut.passed) ?? 0
  const testFailed = defNum(ut.failed) ?? 0
  const testSkipped = defNum(ut.skipped)

  const totalDuration = defNum(meta.duration_seconds) ?? 0
  const buildDuration = defNum(build.duration_seconds)
  const utDuration = defNum(ut.duration_seconds)
  const sampleDuration = defNum(sample.duration_seconds)

  // Estimate environment duration
  const knownDurations = (buildDuration ?? 0) + (utDuration ?? 0) + (sampleDuration ?? 0)
  const envDuration = totalDuration > knownDurations ? totalDuration - knownDurations : undefined

  // v630: 静态分析和 devcontainer 状态
  const staticAnalysis = data.final_results?.static_analysis
  const devcontainer = data.final_results?.devcontainer
  // 兼容 configured 和 config_exists 两种键名
  const preCommitConfigured = staticAnalysis?.pre_commit?.configured !== undefined
    ? staticAnalysis.pre_commit.configured
    : staticAnalysis?.pre_commit?.config_exists
  const preCommitStatus: ConfigStatus = preCommitConfigured !== undefined
    ? (preCommitConfigured ? 'configured' : 'not_configured')
    : 'unknown'
  const lintRunnerStatus: ConfigStatus = staticAnalysis?.lint_runner?.configured !== undefined
    ? (staticAnalysis.lint_runner.configured ? 'configured' : 'not_configured')
    : 'unknown'
  const devcontainerStatus: ConfigStatus = devcontainer?.enabled !== undefined
    ? (devcontainer.enabled ? 'configured' : 'not_configured')
    : 'unknown'

  return {
    name,
    displayName: identity.repoName || name,
    result: deriveOverallResultFromStatus(buildStatus, utStatus, sampleStatus),
    buildStatus,
    utStatus,
    sampleStatus,
    totalDuration,
    environmentDuration: envDuration,
    buildDuration,
    utDuration,
    sampleDuration,
    testPassed,
    testFailed,
    testTotal,
    testSkipped,
    generatedAt: meta.start_time || meta.generated_at || 'N/A',
    environment: data.environment || 'unknown',
    url: identity.url || repoUrl || '',
    category: identity.community,
    preCommitStatus,
    lintRunnerStatus,
    devcontainerStatus,
  }
}

function normalizeToDetail(name: string, data: any): RepoDetail {
  const summary = normalizeToSummary(name, data)

  return {
    ...summary,
    url: data.repo_info?.url || summary.url || data.metadata?.repo_url || '',
    branch: data.metadata?.branch || data.repo_info?.branch || 'master',
    timeline: extractTimeline(data),
    attempts: extractAttempts(data),
    buildResult: normalizeBuildResult(data.final_results?.build, data.execution_log),
    utStats: normalizeUtStats(data.final_results?.ut, data.execution_log, data.problems_encountered),
    documentation: normalizeDocChecklist(data.document_reading_summary),
    documentReadingSummary: data.document_reading_summary,
    dependencies: normalizeDependenciesFromDoc(data.document_reading_summary),
    hardwareConfig: normalizeHardware(data.machine_spec),
    imageSelection: normalizeImageSelection(data.machine_spec?.image_source),
    machineSpec: data.machine_spec,
    // Preserve original report-511 fields from __original for detail page raw JSON dump
    metadata: data.metadata,
    executionLog: data.execution_log,
    processTimeline: data.process_timeline,
    finalResults: data.final_results,
    documentationGaps: data.documentation_gaps,
    problemsEncountered: data.problems_encountered,
    rawData: data,
    // v630: new final_results sub-modules
    staticAnalysis: data.final_results?.static_analysis || undefined,
    devcontainer: data.final_results?.devcontainer || undefined,
  }
}

// ======================== Timeline Extraction ========================

function extractTimeline(data: any): TimelinePhase[] {
  const procTimeline = data.process_timeline || []
  if (procTimeline.length >= 2) {
    return buildTimelineFromProcessEntries(procTimeline)
  }

  // Fallback: from execution_log
  const execLog = data.execution_log || []
  if (execLog.length >= 2) {
    return buildTimelineFromProcessEntries(execLog.map((e: any) => ({
      timestamp: e.timestamp,
      step: e.command,
      action: e.command,
      result: e.success ? 'success' : 'failed',
    })))
  }

  return []
}

function buildTimelineFromProcessEntries(entries: any[]): TimelinePhase[] {
  const sorted = entries
    .map((e: any) => ({ ...e, _ts: Date.parse(e.timestamp || '') }))
    .filter((e: any) => Number.isFinite(e._ts))
    .sort((a: any, b: any) => a._ts - b._ts)

  if (sorted.length < 2) return []

  const phases: TimelinePhase[] = []
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    const nextTime = sorted[i + 1]?._ts
    const duration = nextTime && nextTime > entry._ts
      ? Math.round((nextTime - entry._ts) / 1000)
      : 0

    const step = String(entry.step || entry.action || '').toLowerCase()
    if (duration === 0 && ['start', 'cleanup', 'report', 'end', 'report_generation'].includes(step)) continue

    phases.push({
      phase: entry.action || entry.step || 'unknown',
      durationSeconds: duration,
      status: entry.result || 'unknown',
    })
  }

  return phases
}

// ======================== Attempts ========================

function extractAttempts(data: any): Attempt[] {
  const log = data.execution_log || []
  return log.map((e: any, i: number) => ({
    sequence: i + 1,
    phase: e.command || 'unknown',
    action: e.command || '',
    command: e.command,
    result: e.success ? 'success' : 'failed',
    durationSeconds: typeof e.duration_seconds === 'number' ? e.duration_seconds : (typeof e.duration_estimate === 'string' ? 0 : 0),
    output: e.output || e.output_summary,
    errorMessage: e.error || e.error_message,
  }))
}

// ======================== Build Result ========================

function normalizeBuildResult(build: any, executionLog?: any[]): BuildResult {
  if (!build) return { status: 'unknown' }
  const artifacts: Artifact[] = Array.isArray(build.artifacts)
    ? build.artifacts.map((a: any) => ({
        name: a.name || a.path || 'unknown',
        path: a.path,
        type: a.type,
        sizeBytes: typeof a.size_bytes === 'number' ? a.size_bytes : undefined,
        sizeHuman: a.size,
      }))
    : undefined

  // 合成构建失败原因：优先用 build.error，否则从 execution_log 提取
  let error = build.error
  if (!error && executionLog && Array.isArray(executionLog)) {
    const buildStatus = normalizeStatus(build.status)
    if (buildStatus === 'failed' || buildStatus === 'partial_success') {
      // 收集所有失败步骤的错误信息
      const failures = executionLog
        .filter((e: any) => !e.success && e.error)
        .map((e: any) => String(e.error).trim())
        .filter((s: string) => s.length > 0)
      if (failures.length > 0) {
        // 取最后一条（通常是最终失败原因），截断
        const last = failures[failures.length - 1]
        error = last.length > 200 ? last.slice(0, 197) + '...' : last
      }
    }
  }

  return {
    status: normalizeStatus(build.status),
    buildCommand: build.command || build.build_command,
    durationSeconds: defNum(build.duration_seconds),
    artifacts,
    error,
    command: build.command,
    concurrency: defNum(build.concurrency),
    durationBreakdown: build.duration_breakdown || undefined,
  }
}

// ======================== UT Stats ========================

function normalizeUtStats(ut: any, executionLog?: any[], problemsEncountered?: any[]): UtStats {
  if (!ut) return { status: 'unknown' }
  const total = defNum(ut.total)
  const passed = defNum(ut.passed) ?? 0
  const failed = defNum(ut.failed) ?? 0
  const duration = defNum(ut.duration_seconds)
  const utStatus = normalizeStatus(ut.status)

  // 合成 errorSummary：优先从 ut.failures，否则从 problems_encountered
  let errorSummary: string | undefined
  if (ut.failures && Array.isArray(ut.failures) && ut.failures.length > 0) {
    // 提取前 3 个失败用例的 reason
    const reasons = ut.failures
      .map((f: any) => f.reason || f.test_name || '')
      .filter(Boolean)
      .slice(0, 3)
    errorSummary = reasons.length > 0
      ? `${ut.failures.length}个用例失败: ${reasons.join('; ')}`
      : `${ut.failures.length}个用例失败`
  }

  // 合成 skipReason：当值为 null 或 "unknown" 时，从其他来源推导
  let skipReason: string | undefined = (ut.skip_reason && ut.skip_reason !== 'unknown')
    ? ut.skip_reason
    : undefined

  if (!skipReason && utStatus === 'not_run') {
    // 优先用 ut.reason
    if (ut.reason && ut.reason !== 'unknown') {
      skipReason = ut.reason
    } else {
      // 从 problems_encountered 或 execution_log 推导
      skipReason = deriveNotRunReason(executionLog, problemsEncountered)
    }
  }

  if (!skipReason && (utStatus === 'partial_success' || utStatus === 'failed')) {
    // 有失败用例但无 skip_reason，用 errorSummary 替代
    skipReason = errorSummary || undefined
  }

  // 如果还是没有 skip_reason，但状态不是 success，尝试从 problems 推导
  if (!skipReason && utStatus !== 'success' && utStatus !== 'no_tests') {
    skipReason = deriveNotRunReason(executionLog, problemsEncountered)
  }

  return {
    status: utStatus,
    totalTests: total,
    passed,
    failed,
    skipped: defNum(ut.skipped) ?? 0,
    durationSeconds: duration,
    testSuites: ut.ut_suite_details,
    errorSummary,
    errorDetail: ut.failures?.length ? JSON.stringify(ut.failures) : undefined,
    coveragePercent: ut.coverage_percent,
    skipReason,
  }
}

/** 从执行日志和问题记录中推导不可执行/失败的原因 */
function deriveNotRunReason(executionLog?: any[], problemsEncountered?: any[]): string | undefined {
  // 先从 problems_encountered 提取最相关的问题
  if (problemsEncountered && Array.isArray(problemsEncountered) && problemsEncountered.length > 0) {
    const first = problemsEncountered[0]
    const problem = first.problem || ''
    const solution = first.solution || ''
    const combined = solution ? `${problem}；解决：${solution}` : problem
    if (combined) return combined.length > 200 ? combined.slice(0, 197) + '...' : combined
  }

  // 从 execution_log 提取最后一个失败步骤的 error
  if (executionLog && Array.isArray(executionLog)) {
    const failures = executionLog
      .filter((e: any) => !e.success && e.error)
      .map((e: any) => String(e.error).trim())
      .filter((s: string) => s.length > 0)
    if (failures.length > 0) {
      const last = failures[failures.length - 1]
      return last.length > 200 ? last.slice(0, 197) + '...' : last
    }
  }

  return undefined
}

// ======================== Documentation ========================

function normalizeDocChecklist(ds: any): DocumentationChecklist {
  if (!ds) return {}
  return {
    readmeExists: true,
    readmeHasInstallSection: Boolean(ds.dependencies?.value),
    readmeHasQuickStart: Boolean(ds.sample_commands?.value && ds.sample_commands.value !== 'unknown'),
    buildGuideExists: Boolean(ds.build_commands?.value && ds.build_commands.value !== 'unknown'),
  }
}

function normalizeDependenciesFromDoc(ds: any): DependencyInfo | undefined {
  if (!ds?.dependencies?.value) return undefined
  const deps = Array.isArray(ds.dependencies.value) ? ds.dependencies.value : [ds.dependencies.value]
  if (deps.length === 0) return undefined
  return {
    totalDependencies: deps.length,
    resolvedDependencies: deps.map((d: string) => ({ name: d, type: 'documented' })),
  }
}

// ======================== Hardware ========================

function normalizeHardware(ms: any): HardwareConfig | undefined {
  if (!ms) return undefined
  const host = ms.host_machine || {}
  const container = ms.container || {}
  return {
    server: container.os || host.architecture || 'unknown',
    npuAvailable: false,
  }
}

function normalizeImageSelection(imgSrc: any): ImageSelection | undefined {
  if (!imgSrc) return undefined
  return {
    method: imgSrc.type || 'unknown',
    selectedImage: imgSrc.image_name || 'unknown',
  }
}

// ======================== Status Helpers ========================

function normalizeStatus(status: any): ResultStatus {
  if (!status) return 'unknown'
  const s = String(status).toLowerCase().trim()
  if (s === 'success' || s === 'passed') return 'success'
  if (s === 'failed' || s === 'failure' || s === 'error' || s === 'blocked') return 'failed'
  if (s === 'partial_success' || s === 'partial_failure' || s === 'mainly_success' || s === 'mostly_success' || s.includes('partial') || (s.includes('success') && s.includes('fail'))) return 'partial_success'
  if (s === 'skipped') return 'skipped'
  if (s === 'no_tests' || s === 'not_applicable' || s === 'not_available') return 'no_tests'
  if (s === 'not_run' || s === 'not_executed' || s === 'not_configured' || s === 'not_attempted') return 'not_run'
  return 'unknown'
}

function deriveOverallResultFromStatus(buildStatus: ResultStatus, utStatus: ResultStatus, sampleStatus: ResultStatus): ResultStatus {
  const sampleRan = sampleStatus !== 'not_run' && sampleStatus !== 'unknown' && sampleStatus !== 'no_tests'
  const sampleOk = !sampleRan || sampleStatus === 'success'
  const utEffective = utStatus === 'no_tests' ? 'not_run' : utStatus

  if (buildStatus === 'success' && utStatus === 'success' && sampleOk) return 'success'
  if (buildStatus === 'success' || buildStatus === 'partial_success' || utEffective === 'success' || utEffective === 'partial_success' || (sampleRan && sampleStatus === 'success')) return 'partial_success'
  return 'failed'
}

// ======================== Summary Stats ========================

export function calculateSummaryStats(repos: RepoSummary[]): SummaryStats {
  const total = repos.length
  const success = repos.filter(r => r.result === 'success').length
  const failed = repos.filter(r => r.result === 'failed').length
  const partial = repos.filter(r => r.result === 'partial_success').length
  const avgDuration = repos.reduce((sum, r) => sum + r.totalDuration, 0) / total
  const envDurations = repos.filter(r => r.environmentDuration && r.environmentDuration > 0).map(r => r.environmentDuration!)
  const avgEnvironmentDuration = envDurations.length > 0 ? envDurations.reduce((sum, d) => sum + d, 0) / envDurations.length : 0
  const totalTestsAll = repos.reduce((sum, r) => sum + (r.testTotal ?? 0), 0)
  const totalPassedAll = repos.reduce((sum, r) => sum + (r.testPassed ?? 0), 0)
  const overallPassRate = totalTestsAll > 0 ? Math.round((totalPassedAll / totalTestsAll) * 1000) / 10 : 0
  const buildableCount = repos.filter(r => r.buildStatus === 'success' || r.buildStatus === 'partial_success').length
  const testableCount = repos.filter(r => r.utStatus === 'success' || r.utStatus === 'partial_success').length
  const ttfhwPassRate = total > 0 ? Math.round((success / total) * 100) : 0
  const buildPassRate = total > 0 ? Math.round((buildableCount / total) * 100) : 0
  const other = total - success - failed - partial

  return {
    total, success, failed, partial, other,
    avgDuration, avgEnvironmentDuration,
    totalTestsAll, totalPassedAll, overallPassRate,
    buildableCount, testableCount, ttfhwPassRate, buildPassRate,
  }
}

export function generateStaticParams(): { repo: string }[] {
  return getAllRepoNames().map(name => ({ repo: name }))
}

// ======================== Utils ========================

function defNum(v: any): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return undefined
}
