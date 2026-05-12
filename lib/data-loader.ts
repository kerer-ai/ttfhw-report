import fs from 'fs'
import path from 'path'
import { RepoSummary, RepoDetail, Attempt, BuildResult, UtStats, TimelinePhase, DocumentationChecklist, DependencyInfo, HardwareConfig, ImageSelection, SummaryStats, Artifact, Dependency, MissingDependency, ResultStatus } from './types'
import { deriveRepoIdentity } from './utils'

const JSON_DIR = path.join(process.cwd(), 'json')

// 获取所有仓库名称（从JSON文件名提取）
export function getAllRepoNames(): string[] {
  return fs.readdirSync(JSON_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
    .map(dirent => {
      let name = dirent.name
        .replace('verification_report_', '')
        .replace('.json', '')
        .replace(/_202605\d{2}$/, '')  // 移除日期后缀
        .replace(/_202605\d{2}_final$/, '')  // 移除日期+final后缀
      return name
    })
    .sort()
}

// 获取所有仓库汇总数据
export function getAllRepoSummaries(): RepoSummary[] {
  const repos = getAllRepoNames()
  return repos.map(name => {
    try {
      const data = loadReportData(name)
      return normalizeToSummary(name, data)
    } catch (e) {
      const identity = deriveRepoIdentity({ fallbackName: name })
      return {
        name,
        displayName: identity.repoName || name,
        result: 'unknown',
        buildStatus: 'unknown',
        utStatus: 'unknown',
        sampleStatus: 'unknown',
        totalDuration: 0,
        environmentDuration: undefined,
        buildDuration: undefined,
        utDuration: undefined,
        sampleDuration: undefined,
        testPassed: 0,
        testFailed: 0,
        testTotal: undefined,
        testSkipped: undefined,
        generatedAt: 'N/A',
        environment: 'unknown',
        category: identity.community,
      }
    }
  })
}

// 获取单个仓库详情
export function getRepoDetail(repoName: string): RepoDetail | null {
  try {
    const data = loadReportData(repoName)
    return normalizeToDetail(repoName, data)
  } catch (e) {
    return null
  }
}

function loadReportData(repoName: string): any {
  // 尝试多种文件名格式（优先更新日期，优先带 WSL/Ubuntu 前缀）
  const possibleNames = [
    `verification_report_WSL_${repoName}_20260512.json`,
    `verification_report_WSL_${repoName}_20260511.json`,
    `verification_report_WSL_${repoName}_20260511_final.json`,
    `verification_report_WSL_${repoName}_20260510.json`,
    `verification_report_Ubuntu_${repoName}_20260512.json`,
    `verification_report_Ubuntu_${repoName}_20260511.json`,
    `verification_report_Ubuntu_${repoName}_20260510.json`,
    `verification_report_${repoName}_20260512.json`,
    `verification_report_${repoName}_20260511.json`,
    `verification_report_${repoName}_20260511_final.json`,
    `verification_report_${repoName}_20260510.json`,
    `verification_report_${repoName}.json`,
  ]

  for (const filename of possibleNames) {
    const reportPath = path.join(JSON_DIR, filename)
    if (fs.existsSync(reportPath)) {
      const rawData = fs.readFileSync(reportPath, 'utf-8')
      const data = JSON.parse(rawData)
      // 转换 report-511 格式到标准格式，传入 repoName 作为 fallback
      return convertReport511Format(data, repoName)
    }
  }

  throw new Error(`Report not found for ${repoName}`)
}

// 转换 report-511 JSON 格式到 verify 项目期望的格式
function convertReport511Format(data: any, repoName?: string): any {
  // 如果已经是标准格式，直接返回
  if (data.meta && data.build_result) {
    return { ...data, __original: data }
  }

  // openEuler/bishengjdk 格式（verification_info 顶级键）
  if (data.verification_info) {
    return convertOpenEulerFormat(data, repoName)
  }

  // stratovirt 格式（verification_summary 顶级键）
  if (data.verification_summary) {
    return convertStratovirtFormat(data, repoName)
  }

  // 原有 report-511 格式（metadata 顶级键）
  return convertReport511LegacyFormat(data, repoName)
}
function convertReport511LegacyFormat(data: any, repoName?: string): any {
  const metadata = data.metadata || {}
  const meta = {
    report_version: '3.0',
    skill_name: 'ttfhw-verify',
    generated_at: metadata.start_time || 'N/A',
    generator: 'Claude Code',
    remote_server: 'local'
  }

  // 转换 repo_info
  const identity = deriveRepoIdentity({
    fallbackName: repoName || data.repo_info?.name || metadata.repo_name || 'unknown',
    repoPath: metadata.repo_path,
    repoUrl: metadata.repo_url,
    repoInfoName: data.repo_info?.name || metadata.repo_name,
    repoInfoUrl: data.repo_info?.url,
  })
  const repoInfo = {
    name: identity.repoName,
    url: identity.url || '',
    branch: 'master'
  }

  // 转换 final_results -> build_result/ut_stats
  const finalResults = data.final_results || {}
  const buildResult = {
    status: normalizeStatusString(finalResults.build?.status),
    build_command: data.document_reading_summary?.build_commands?.value || '',
    error: finalResults.build?.reason || '',
    build_duration_seconds: finalResults.build?.duration_seconds,
    duration_seconds: finalResults.build?.duration_seconds
  }

  const utStats = {
    ut_status: normalizeStatusString(finalResults.ut?.status),
    ut_skipped_reason: finalResults.ut?.reason || '',
    ut_total_count: finalResults.ut?.total,
    ut_passed_count: finalResults.ut?.passed,
    ut_failed_count: finalResults.ut?.failed,
    total_tests: finalResults.ut?.total,
    passed: finalResults.ut?.passed,
    failed: finalResults.ut?.failed,
    ut_duration_seconds: finalResults.ut?.duration_seconds,
    duration_seconds: finalResults.ut?.duration_seconds
  }

  // 转换 document_reading_summary -> documentation_checklist
  const docSummary = data.document_reading_summary || {}
  const docChecklist = {
    readme_found: true,
    build_docs_found: Boolean(docSummary.build_commands),
    readme_has_quick_start: Boolean(docSummary.sample_commands),
    readme_has_install_section: Boolean(docSummary.dependencies)
  }

  // 转换 execution_log -> attempt_log
  const executionLog = data.execution_log || []
  const attempts = executionLog.map((log: any, i: number) => ({
    sequence: i + 1,
    phase: log.step || 'unknown',
    action: log.step || '',
    command: log.command || '',
    result: log.success ? 'success' : 'failed',
    duration_seconds: 0,
    output: log.output || '',
    error_message: log.error || ''
  }))

  // 计算 duration
  const durationSeconds = metadata.duration_seconds || 0

  // 转换 machine_spec -> hardware_config
  const machineSpec = data.machine_spec || {}
  const hardwareConfig = {
    npu_available: false,
    server: machineSpec.host_machine?.os || 'WSL'
  }

  // 构建 overall
  const overall = {
    build_status: buildResult.status,
    ut_status: utStats.ut_status,
    sample_status: normalizeStatusString(finalResults.sample?.status),
    result: deriveOverallResultSimple(buildResult.status, utStats.ut_status)
  }

  return {
    meta,
    repo_info: repoInfo,
    documentation_checklist: docChecklist,
    build_result: buildResult,
    ut_stats: utStats,
    attempt_log: { attempts, total_attempts: attempts.length },
    hardware_config: hardwareConfig,
    overall,
    ttfhw_timeline: { total_attempt_duration_seconds: durationSeconds },
    problems_encountered: data.problems_encountered || [],
    __original: data
  }
}

// 转换 openEuler 格式（bishengjdk-8 等）
function convertOpenEulerFormat(data: any, repoName?: string): any {
  const vi = data.verification_info || {}
  const env = data.execution_environment || {}
  const doc = data.document_analysis || {}
  const deps = data.dependency_installation || {}
  const cfg = data.build_configuration || {}
  const bld = data.build_execution || {}
  const ut = data.unit_tests || {}
  const sample = data.samples || {}
  const result = data.verification_result || {}

  const actualRepoName = vi.repository || repoName || 'unknown'
  const identity = deriveRepoIdentity({
    fallbackName: actualRepoName,
    repoUrl: vi.repository_url,
    repoInfoName: actualRepoName,
    repoInfoUrl: vi.repository_url,
  })

  const buildStatus = mapOpenEulerStatus(bld.status)
  const utStatus = mapOpenEulerStatus(ut.status || ut.test_results?.status)
  const sampleStatus = mapOpenEulerStatus(sample.status)
  const buildDuration = parseTimeString(bld.build_time)

  return {
    meta: {
      report_version: '3.0',
      skill_name: 'ttfhw-verify',
      generated_at: vi.verification_date || 'N/A',
      generator: 'Claude Code',
      remote_server: 'local',
    },
    repo_info: {
      name: identity.repoName,
      url: identity.url || vi.repository_url || '',
      branch: 'master',
    },
    build_result: {
      status: buildStatus,
      build_command: cfg.configure_command || doc.build_command || '',
      error: bld.errors ? String(bld.errors) : '',
      build_duration_seconds: buildDuration,
      duration_seconds: buildDuration,
    },
    ut_stats: {
      ut_status: utStatus,
      ut_skipped_reason: ut.note || '',
      ut_total_count: ut.test_results?.total,
      ut_passed_count: ut.test_results?.passed,
      ut_failed_count: ut.test_results?.failed,
      total_tests: ut.test_results?.total,
      passed: ut.test_results?.passed,
      failed: ut.test_results?.failed,
    },
    attempt_log: {
      attempts: buildOpenEulerExecutionLog(data),
      total_attempts: 5,
    },
    documentation_checklist: {
      readme_found: true,
      build_docs_found: Boolean(doc.build_command),
      readme_has_quick_start: Boolean(doc.sample_command),
      readme_has_install_section: Boolean(doc.build_dependencies),
    },
    hardware_config: {
      server: env.os || 'unknown',
      npu_available: false,
    },
    overall: {
      build_status: buildStatus,
      ut_status: utStatus,
      sample_status: sampleStatus,
      result: deriveOverallResultSimple(buildStatus, utStatus),
    },
    ttfhw_timeline: { total_attempt_duration_seconds: buildDuration || 0 },
    problems_encountered: (data.issues_and_solutions || []).map((iss: any) => ({
      problem: iss.issue,
      root_cause: iss.cause,
      solution: iss.solution,
      resolved: iss.status === '已解决',
    })),
    __original: data,
  }
}

// 转换 stratovirt 格式（verification_summary 顶级键）
function convertStratovirtFormat(data: any, repoName?: string): any {
  const vs = data.verification_summary || {}
  const env = vs.environment || {}
  const build = vs.build_result || {}
  const test = vs.test_result || {}
  const conclusion = vs.conclusion || {}

  const urlMatch = vs.repository?.match(/\/([^/]+)\.git$/)
  const derivedName = urlMatch ? urlMatch[1] : (repoName || 'stratovirt')

  const identity = deriveRepoIdentity({
    fallbackName: derivedName,
    repoUrl: vs.repository,
    repoInfoName: derivedName,
    repoInfoUrl: vs.repository,
  })

  const buildStatus = build.status === 'SUCCESS' ? 'success' : 'failed'
  const utStatus = mapStratovirtTestStatus(test.status)
  const buildDuration = parseDurationString(build.duration)

  return {
    meta: {
      report_version: '3.0',
      skill_name: 'ttfhw-verify',
      generated_at: vs.verification_date || 'N/A',
      generator: 'Claude Code',
      remote_server: 'local',
    },
    repo_info: {
      name: identity.repoName,
      url: identity.url || vs.repository || '',
      branch: 'master',
    },
    build_result: {
      status: buildStatus,
      build_command: build.command || '',
      error: '',
      build_duration_seconds: buildDuration,
      duration_seconds: buildDuration,
    },
    ut_stats: {
      ut_status: utStatus,
      ut_skipped_reason: test.failure_reason || '',
      ut_total_count: test.total_tests,
      ut_passed_count: test.passed_tests,
      ut_failed_count: (test.total_tests || 0) - (test.passed_tests || 0),
      total_tests: test.total_tests,
      passed: test.passed_tests,
      failed: (test.total_tests || 0) - (test.passed_tests || 0),
    },
    attempt_log: {
      attempts: [
        {
          sequence: 1,
          phase: 'build',
          action: '构建',
          command: build.command || '',
          result: buildStatus === 'success' ? 'success' : 'failed',
          duration_seconds: buildDuration || 0,
          output: build.output_binary ? `${build.output_binary} (${build.binary_size})` : '',
        },
        {
          sequence: 2,
          phase: 'test',
          action: '测试',
          command: 'cargo test',
          result: utStatus === 'success' ? 'success' : (utStatus === 'partial_success' ? 'partial_success' : 'failed'),
          duration_seconds: 0,
          output: `${test.passed_tests || 0}/${test.total_tests || 0} passed`,
        },
      ],
      total_attempts: 2,
    },
    documentation_checklist: {
      readme_found: true,
    },
    hardware_config: {
      server: env.os || 'unknown',
      npu_available: false,
    },
    overall: {
      build_status: buildStatus,
      ut_status: utStatus,
      sample_status: 'not_run',
      result: deriveOverallResultSimple(buildStatus, utStatus),
    },
    ttfhw_timeline: { total_attempt_duration_seconds: buildDuration || 0 },
    problems_encountered: (vs.issues_encountered || []).map((iss: any) => ({
      problem: iss.issue,
      root_cause: iss.description,
      solution: iss.resolution,
      resolved: iss.status === 'RESOLVED',
    })),
    __original: data,
  }
}

function buildOpenEulerExecutionLog(data: any): any[] {
  const log: any[] = []
  const vi = data.verification_info || {}
  const env = data.execution_environment || {}
  const deps = data.dependency_installation || {}
  const cfg = data.build_configuration || {}
  const bld = data.build_execution || {}
  const ut = data.unit_tests || {}
  const sample = data.samples || {}

  if (env.docker_image) {
    log.push({
      timestamp: vi.verification_date || '',
      step: '容器设置',
      command: `docker run ${env.container_name || ''} ${env.docker_image}`,
      success: true,
      output: `${env.os} ${env.architecture}`,
    })
  }
  if (deps.packages_installed?.length) {
    log.push({
      timestamp: vi.verification_date || '',
      step: '安装依赖',
      command: `dnf install -y ${deps.packages_installed.slice(0, 5).join(' ')}...`,
      success: deps.status === '成功',
      output: `${deps.packages_installed.length} packages installed`,
    })
  }
  if (cfg.configure_command) {
    log.push({
      timestamp: vi.verification_date || '',
      step: '配置构建',
      command: cfg.configure_command,
      success: cfg.status === '成功',
      output: cfg.configure_output?.configuration_name || '',
    })
  }
  if (bld.build_time) {
    log.push({
      timestamp: vi.verification_date || '',
      step: '构建',
      command: 'make',
      success: bld.status === '成功',
      output: `Duration: ${bld.build_time}, Errors: ${bld.errors || 0}`,
    })
  }
  if (ut.test_results) {
    log.push({
      timestamp: vi.verification_date || '',
      step: 'UT',
      command: 'make test',
      success: ut.test_results?.status === '通过',
      output: ut.test_results?.sample_test || '',
    })
  }
  return log
}

function buildOpenEulerTimeline(data: any): any[] {
  const vi = data.verification_info || {}
  const tl: any[] = []
  const steps = [
    { key: 'dependency_installation', name: '安装依赖' },
    { key: 'build_configuration', name: '配置' },
    { key: 'build_execution', name: '构建' },
    { key: 'unit_tests', name: 'UT' },
    { key: 'samples', name: '示例' },
  ]
  for (const { key, name } of steps) {
    const item = data[key]
    if (item) {
      tl.push({
        timestamp: vi.verification_date || '',
        step: key,
        action: name,
        result: item.status || 'unknown',
      })
    }
  }
  return tl
}

function mapOpenEulerStatus(status: string | undefined): string {
  if (!status) return 'unknown'
  const s = status.toLowerCase()
  if (s.includes('成功') || s.includes('success') || s.includes('通过')) return 'success'
  if (s.includes('失败') || s.includes('fail') || s.includes('error')) return 'failed'
  if (s.includes('部分') || s.includes('partial')) return 'partial_success'
  return 'unknown'
}

function mapStratovirtTestStatus(status: string | undefined): string {
  if (!status) return 'unknown'
  const s = status.toUpperCase()
  if (s === 'SUCCESS') return 'success'
  if (s === 'PARTIAL_FAILURE') return 'partial_success'
  if (s === 'FAILED') return 'failed'
  return 'unknown'
}

function parseTimeString(timeStr: string | undefined): number | undefined {
  if (!timeStr) return undefined
  // "00:09:03" or "8m 48s"
  const hms = timeStr.match(/(\d{2}):(\d{2}):(\d{2})/)
  if (hms) return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3])
  return parseDurationString(timeStr)
}

function parseDurationString(dur: string | undefined): number | undefined {
  if (!dur) return undefined
  // "8m 48s"
  let total = 0
  const minMatch = dur.match(/(\d+)\s*m/)
  if (minMatch) total += parseInt(minMatch[1]) * 60
  const secMatch = dur.match(/(\d+)\s*s/)
  if (secMatch) total += parseInt(secMatch[1])
  return total > 0 ? total : undefined
}

function normalizeStatusString(status: any): string {
  if (!status) return 'unknown'
  const s = String(status).toLowerCase()
  if (s.includes('success') && !s.includes('partial')) return 'success'
  if (s.includes('partial')) return 'partial_success'
  if (s.includes('block')) return 'failed'
  if (s.includes('fail') || s.includes('unsuccessful')) return 'failed'
  if (s.includes('skip') || s.includes('not')) return 'not_run'
  return 'unknown'
}

function deriveOverallResultSimple(buildStatus: string, utStatus: string): ResultStatus {
  if (buildStatus === 'success' && utStatus === 'success') return 'success'
  if (buildStatus === 'success' || buildStatus === 'partial_success') return 'partial_success'
  return 'failed'
}

// 计算汇总统计
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
  const overallPassRate = totalTestsAll > 0 ? Math.round((totalPassedAll / totalTestsAll) * 100) : 0
  const buildableCount = repos.filter(r => r.buildStatus === 'success' || r.buildStatus === 'partial_success').length
  const testableCount = repos.filter(r => r.utStatus === 'success' || r.utStatus === 'partial_success').length
  const ttfhwPassRate = total > 0 ? Math.round((success / total) * 100) : 0
  const buildPassRate = total > 0 ? Math.round((buildableCount / total) * 100) : 0

  return {
    total,
    success,
    failed,
    partial,
    avgDuration,
    avgEnvironmentDuration,
    totalTestsAll,
    totalPassedAll,
    overallPassRate,
    buildableCount,
    testableCount,
    ttfhwPassRate,
    buildPassRate,
  }
}

// 归一化为汇总数据（兼容标准格式和旧格式）
function normalizeToSummary(name: string, data: any): RepoSummary {
  const meta = data.meta || {}
  const overall = data.overall || {}
  const utStats = data.ut_stats || {}
  const utStatus = normalizeUtStats(utStats, data).status
  const timeline = data.ttfhw_timeline || {}
  const repoInfo = data.repo_info || {}
  const original = data.__original || {}
  const identity = deriveRepoIdentity({
    fallbackName: name,
    repoPath: original.metadata?.repo_path,
    repoUrl: original.metadata?.repo_url,
    repoInfoName: original.metadata?.repo_name || repoInfo.name,
    repoInfoUrl: repoInfo.url,
  })
  const buildStatus = normalizeStatus(data.build_result?.status)
  const sampleStatus = getSampleStatus(data)

  // 兼容多种字段名：ut_xxx_count (标准) / passed/total_tests (旧) / test_cases
  // 注意：有些仓库的 total 是字符串如 "300+ (全部)", 需要提取数字部分
  const testPassed = extractNumber(utStats.ut_passed_count ?? utStats.passed ?? utStats.tests_passed) ?? 0
  const testFailed = extractNumber(utStats.ut_failed_count ?? utStats.failed ?? utStats.tests_failed) ?? 0
  const testTotal = extractNumber(utStats.ut_total_count ?? utStats.total_tests ?? utStats.test_cases ?? utStats.tests_total)
  const testSkipped = extractNumber(utStats.ut_skipped_count ?? utStats.skipped ?? utStats.tests_skipped)
  const totalDuration = getDisplayDuration(data)

  return {
    name,
    displayName: identity.repoName || repoInfo.name || name,
    result: deriveOverallResultFromStatus(buildStatus, utStatus, sampleStatus),
    buildStatus,
    utStatus,
    sampleStatus,
    totalDuration,
    environmentDuration: getEnvironmentDuration(data),
    buildDuration: getBuildDuration(data),
    utDuration: getUtDuration(data),
    sampleDuration: getSampleDuration(data),
    testPassed,
    testFailed,
    testTotal,
    testSkipped,
    generatedAt: meta.generated_at || 'N/A',
    environment: meta.remote_server || data.hardware_config?.ssh_target ? 'remote' : 'unknown',
    url: identity.url || repoInfo.url,
    category: identity.community,
  }
}

// 归一化为详情数据（统一格式后简化版）
function normalizeToDetail(name: string, data: any): RepoDetail {
  const summary = normalizeToSummary(name, data)
  const repoInfo = data.repo_info || {}
  const original = data.__original || {}

  return {
    ...summary,
    url: repoInfo.url || '',
    branch: repoInfo.branch,
    timeline: extractTimeline(data),
    attempts: extractAttempts(data.attempt_log?.attempts || []),
    buildResult: normalizeBuildResult(data.build_result),
    utStats: normalizeUtStats(data.ut_stats, data),
    documentation: normalizeDocChecklist(data.documentation_checklist),
    dependencies: normalizeDependencies(data.dependency_stats),
    hardwareConfig: normalizeHardware(data.hardware_config),
    imageSelection: normalizeImageSelection(data.image_selection),
    issues: overallIssues(data),
    recommendations: overallRecommendations(data),
    // report-511 特有字段 - 直接从原始数据提取
    metadata: original.metadata,
    machineSpec: original.machine_spec,
    documentReadingSummary: original.document_reading_summary,
    executionLog: original.execution_log,
    processTimeline: original.process_timeline,
    finalResults: original.final_results,
    utStAnalysis: original.ut_st_analysis,
    documentationGaps: original.documentation_gaps,
    problemsEncountered: original.problems_encountered,
    conclusion: original.conclusion,
    rawData: original,
  }
}

function extractTimeline(data: any): TimelinePhase[] {
  const timeline = data?.ttfhw_timeline
  if (!timeline) return []

  const phases: TimelinePhase[] = []
  const phaseNames = [
    { key: 'clone_duration_seconds', name: '克隆仓库' },
    { key: 'docs_reading_estimate_seconds', name: '阅读文档' },
    { key: 'image_pull_duration_seconds', name: '拉取镜像' },
    { key: 'container_startup_seconds', name: '启动容器' },
    { key: 'container_start_duration_seconds', name: '启动容器' },
    { key: 'dependency_install_duration_seconds', name: '安装依赖' },
    { key: 'third_party_build_duration_seconds', name: '构建三方依赖' },
    { key: 'megatron_core_install_seconds', name: '安装 Megatron Core' },
    { key: 'meson_setup_duration_seconds', name: 'Meson 配置' },
    { key: 'build_duration_seconds', name: '构建' },
    { key: 'wheel_generation_duration_seconds', name: '生成 Wheel' },
    { key: 'ut_build_duration_seconds', name: '构建 UT' },
    { key: 'ut_duration_seconds', name: '运行 UT' },
    { key: 'quick_start_duration_seconds', name: '运行示例' },
  ]

  for (const { key, name } of phaseNames) {
    const duration = getPhaseDuration(key, data)
    if (duration && typeof duration === 'number' && duration > 0) {
      phases.push({
        phase: name,
        durationSeconds: duration,
        status: 'success',
      })
    }
  }

  const totalDuration = getDisplayDuration(data)
  const explainedDuration = phases.reduce((sum, phase) => sum + phase.durationSeconds, 0)
  const unclassifiedDuration = totalDuration - explainedDuration

  if (unclassifiedDuration > 1) {
    phases.push({
      phase: '未归类耗时',
      durationSeconds: unclassifiedDuration,
      status: 'unknown',
    })
  }

  return phases
}

function extractAttempts(attempts: any[]): Attempt[] {
  return attempts.map(a => ({
    sequence: a.sequence || 0,
    phase: a.phase || 'unknown',
    action: a.action || '',
    command: a.command,
    result: a.result || 'unknown',
    durationSeconds: a.duration_seconds || 0,
    output: a.output,
    errorMessage: a.error_message,
  }))
}

function normalizeBuildResult(buildResult: any): BuildResult {
  if (!buildResult) {
    return { status: 'unknown' }
  }

  const artifacts = normalizeArtifacts(buildResult.artifacts)

  return {
    status: normalizeStatus(buildResult.status),
    buildCommand: buildResult.build_command,
    durationSeconds: buildResult.build_duration_seconds ?? buildResult.duration_seconds,
    artifacts,
    error: buildResult.error,
    warnings: buildResult.warnings,
    targetsCount: buildResult.total_targets ?? buildResult.artifacts_count ?? artifacts?.length,
    progress: buildResult.progress,
  }
}

function normalizeArtifacts(artifacts: any): Artifact[] | undefined {
  if (!artifacts) return undefined
  if (Array.isArray(artifacts)) {
    return artifacts.map(a => {
      if (typeof a === 'string') {
        return { name: a }
      }
      return {
        name: a.name || path.basename(a.path || ''),
        path: a.path,
        type: a.type,
        sizeBytes: a.size_bytes,
        sizeHuman: a.size || a.size_human,
      }
    })
  }
  return undefined
}

function normalizeUtStats(utStats: any, data?: any): UtStats {
  if (!utStats) {
    return { status: 'unknown' }
  }

  // 兼容多种字段名：test_cases 也很常见
  // 注意：有些仓库的 total 是字符串如 "300+ (全部)", 需要提取数字部分
  const originalUt = data?.__original?.ut_stats || {}
  const totalTests = extractNumber(utStats.ut_total_count ?? utStats.total_tests ?? utStats.test_cases ?? utStats.tests_total)
  const passed = extractNumber(utStats.ut_passed_count ?? utStats.passed ?? utStats.tests_passed) ?? 0
  const failed = extractNumber(utStats.ut_failed_count ?? utStats.failed ?? utStats.tests_failed) ?? 0
  const skipped = extractNumber(utStats.ut_skipped_count ?? utStats.skipped ?? utStats.tests_skipped) ?? 0
  const duration = numberOrUndefined(utStats.ut_duration_seconds ?? utStats.duration_seconds ?? originalUt.execution_time_seconds)
  const status = normalizeStatus(utStats.ut_status || utStats.status || inferUtStatus(utStats))
  const normalizedStatus = status === 'unknown' && !hasExecutedUt(totalTests, passed, failed, duration)
    ? 'not_run'
    : status

  return {
    framework: utStats.ut_framework || utStats.framework || 'unknown',
    status: normalizedStatus,
    totalTests,
    passed,
    failed,
    skipped,
    disabled: utStats.ut_timeout_count,
    durationSeconds: duration,
    testSuites: utStats.test_suites || utStats.ut_suite_details,
    errorSummary: utStats.error_summary || summarizeUtFailure(utStats, originalUt),
    errorDetail: utStats.error_detail || detailUtFailure(utStats, originalUt),
    coveragePercent: utStats.coverage_lines_pct ?? utStats.coverage_percent,
  }
}

function inferUtStatus(utStats: any): ResultStatus {
  // 兼容多种字段名
  const total = utStats.ut_total_count ?? utStats.total_tests ?? utStats.test_cases ?? utStats.tests_total
  const passed = (utStats.ut_passed_count ?? utStats.passed ?? utStats.tests_passed) ?? 0
  const failed = (utStats.ut_failed_count ?? utStats.failed ?? utStats.tests_failed) ?? 0

  if (!total) return 'unknown'
  if (failed === 0 && passed === total) return 'success'
  if (failed > 0) return 'partial_success'
  return 'unknown'
}

function hasExecutedUt(totalTests: number | undefined, passed: number, failed: number, duration: number | undefined): boolean {
  return (totalTests !== undefined && totalTests > 0) || passed > 0 || failed > 0 || (duration !== undefined && duration > 0)
}

function normalizeDocChecklist(docChecklist: any): DocumentationChecklist {
  if (!docChecklist) {
    return {}
  }

  return {
    readmeExists: docChecklist.readme_found ?? false,
    readmeHasInstallSection: docChecklist.readme_has_install_section ?? docChecklist.readme_sections?.install_guide ?? docChecklist.readme_sections?.installation ?? false,
    readmeHasQuickStart: docChecklist.readme_has_quick_start ?? docChecklist.readme_has_quick_start_section ?? docChecklist.readme_sections?.quick_start ?? false,
    readmeHasApiSection: docChecklist.readme_has_api_section ?? false,
    buildGuideExists: docChecklist.build_docs_found ?? false,
    contributingGuideExists: docChecklist.contributing_found ?? docChecklist.contributing_guide_found ?? false,
    devcontainerExists: docChecklist.devcontainer_found ?? false,
    dockerfileExists: docChecklist.dockerfile_found ?? false,
    docsDirectoryExists: docChecklist.docs_directory_exists ?? false,
    exampleDirectoryExists: docChecklist.example_directory_exists ?? false,
  }
}

function normalizeDependencies(depStats: any): DependencyInfo | undefined {
  if (!depStats) return undefined

  const resolvedDependencies: Dependency[] = []
  addDependencies(resolvedDependencies, depStats.dependencies_installed, 'installed')
  addDependencies(resolvedDependencies, depStats.installed_packages, 'installed')
  addDependencies(resolvedDependencies, depStats.system_dependencies, 'system')
  addDependencies(resolvedDependencies, depStats.system_dependencies_installed, 'system')
  addDependencies(resolvedDependencies, depStats.system_dependencies_preinstalled, 'system')
  addDependencies(resolvedDependencies, depStats.build_dependencies, 'build')
  addDependencies(resolvedDependencies, depStats.test_dependencies, 'test')
  addDependencies(resolvedDependencies, depStats.optional_dependencies, 'optional')
  addDependencies(resolvedDependencies, depStats.third_party_deps, 'third-party')
  addDependencies(resolvedDependencies, depStats.third_party_libs, 'third-party')
  addDependencies(resolvedDependencies, depStats.third_party_fetched, 'third-party')
  addDependencies(resolvedDependencies, depStats.test_dependencies_built, 'test')
  addDependencies(resolvedDependencies, depStats.build_system_packages, 'build')
  addDependencies(resolvedDependencies, depStats.compiler_packages, 'compiler')
  addDependencies(resolvedDependencies, depStats.library_packages, 'library')
  addDependencies(resolvedDependencies, depStats.subprojects, 'subproject')
  addDependencies(resolvedDependencies, depStats.submodules?.details, 'submodule')

  const missingDependencies: (string | MissingDependency)[] = []
  addMissingDependencies(missingDependencies, depStats.missing_dependencies)
  addMissingDependencies(missingDependencies, depStats.missing_packages)
  addMissingDependencies(missingDependencies, depStats.pip_conflicts)

  return {
    totalDependencies: depStats.total_dependencies
      ?? depStats.total_packages
      ?? depStats.total_packages_installed
      ?? resolvedDependencies.length,
    resolvedDependencies,
    missingDependencies: missingDependencies.length > 0 ? missingDependencies : undefined,
  }
}

function normalizeHardware(hardwareConfig: any): HardwareConfig | undefined {
  if (!hardwareConfig) return undefined

  return {
    server: hardwareConfig.server,
    npuAvailable: hardwareConfig.npu_available,
    npuCount: hardwareConfig.npu_count,
    npuDevice: hardwareConfig.npu_model ?? hardwareConfig.npu_device,
    npuStatus: hardwareConfig.npu_status ?? (hardwareConfig.npu_available ? 'available' : 'unavailable'),
  }
}

function normalizeImageSelection(imageSelection: any): ImageSelection | undefined {
  if (!imageSelection) return undefined

  return {
    method: imageSelection.method,
    selectedImage: imageSelection.selected_image,
    toolVersions: imageSelection.image_tool_versions,
  }
}

function overallIssues(data: any): (string | Record<string, any>)[] | undefined {
  const overall = data.overall || {}
  const build = data.build_result || {}

  const issues: (string | Record<string, any>)[] = []

  if (overall.critical_findings && Array.isArray(overall.critical_findings)) {
    issues.push(...overall.critical_findings)
  }

  if (data.attempt_log?.issues_encountered && Array.isArray(data.attempt_log.issues_encountered)) {
    issues.push(...data.attempt_log.issues_encountered)
  }

  if (build.error) {
    issues.push(typeof build.error === 'string' ? build.error : build.error)
  }

  return issues.length > 0 ? issues : undefined
}

function overallRecommendations(data: any): (string | Record<string, any>)[] | undefined {
  const overall = data.overall || {}

  if (overall.recommendations && Array.isArray(overall.recommendations)) {
    return overall.recommendations
  }

  return undefined
}

// 为详情页生成静态参数
export function generateStaticParams(): { repo: string }[] {
  return getAllRepoNames().map(name => ({ repo: name }))
}

function normalizeStatus(status: any): ResultStatus {
  if (status === 'success' || status === 'failed' || status === 'partial_success' || status === 'skipped' || status === 'not_run') {
    return status
  }
  return 'unknown'
}

function deriveOverallResult(buildable: boolean, testable: boolean, exampleRunnable: boolean): ResultStatus {
  if (buildable && testable && exampleRunnable) return 'success'
  if (buildable || testable || exampleRunnable) return 'partial_success'
  return 'failed'
}

function deriveOverallResultFromStatus(buildStatus: ResultStatus, utStatus: ResultStatus, sampleStatus: ResultStatus): ResultStatus {
  if (buildStatus === 'success' && utStatus === 'success' && sampleStatus === 'success') return 'success'
  if (buildStatus === 'success' || buildStatus === 'partial_success' || utStatus === 'success' || utStatus === 'partial_success' || sampleStatus === 'success') return 'partial_success'
  return 'failed'
}

function getSampleStatus(data: any): ResultStatus {
  const quickStart = data.__original?.quick_start_analysis
  const quickStartStatus = quickStart?.execution_result?.status

  if (typeof data.overall?.example_runnable === 'boolean') return data.overall.example_runnable ? 'success' : 'failed'
  if (typeof quickStart?.example_runnable === 'boolean') return quickStart.example_runnable ? 'success' : 'failed'

  // 从 final_results.sample 获取状态
  const finalSample = data.__original?.final_results?.sample || {}
  if (finalSample.status) return normalizeStatusString(finalSample.status) as ResultStatus

  return quickStartStatus ? normalizeStatusString(quickStartStatus) as ResultStatus : 'unknown'
}

function sumTimelineDurations(timeline: any): number {
  if (!timeline || typeof timeline !== 'object') return 0
  return Object.entries(timeline)
    .filter(([key, value]) => key.endsWith('_seconds') && typeof value === 'number')
    .reduce((sum, [, value]) => sum + (value as number), 0)
}

function getDisplayDuration(data: any): number {
  const original = data.__original || {}
  const timeline = data.ttfhw_timeline || {}
  const attemptLog = data.attempt_log || {}
  const phaseDuration = sumDisplayPhases(data)

  return original.metadata?.duration_seconds
    ?? diffSeconds(original.metadata?.start_time, original.metadata?.end_time)
    ?? timeline.total_attempt_duration_seconds
    ?? attemptLog.total_attempt_duration_seconds
    ?? timeline.total_ttfhw_seconds
    ?? (phaseDuration > 0 ? phaseDuration : undefined)
    ?? 0
}

function getEnvironmentDuration(data: any): number | undefined {
  const original = data.__original || {}
  const finalResults = original.final_results || {}
  const metadataDuration = original.metadata?.duration_seconds

  // 优先从 final_results 计算环境准备时长
  const finalBuildDuration = finalResults.build?.duration_seconds
  const finalUtDuration = finalResults.ut?.duration_seconds
  const finalSampleDuration = finalResults.sample?.duration_seconds

  if (metadataDuration) {
    // 如果 final_results 有时长数据，直接计算
    if (finalBuildDuration || finalUtDuration || finalSampleDuration) {
      const envDuration = metadataDuration - (finalBuildDuration ?? 0) - (finalUtDuration ?? 0) - (finalSampleDuration ?? 0)
      if (envDuration > 0) return envDuration
    } else {
      // 如果 final_results 没有时长，使用估算的 build/ut/sample 时长计算
      const estimatedBuild = getBuildDuration(data) ?? 0
      const estimatedUt = getUtDuration(data) ?? 0
      const estimatedSample = getSampleDuration(data) ?? 0
      const envDuration = metadataDuration - estimatedBuild - estimatedUt - estimatedSample
      if (envDuration > 0) return envDuration
    }
  }

  // 回退到估算值
  return data.ttfhw_timeline?.dependency_install_duration_seconds
    ?? original.dependency_stats?.install_duration_seconds
    ?? estimateEnvironmentPreparationDuration(original.execution_log || original.build_execution_log || [])
    ?? estimateEnvironmentPreparationDuration(original.process_timeline || [])
    ?? estimatePhaseDuration(original, ['clone', 'docker_pull', 'container_start', 'deps_install', 'torch_install', 'pull', '启动', 'docker run', 'apt-get', 'pip install', 'install', 'clone', 'container', 'environment', 'setup', '配置', '安装依赖', '依赖', 'cann', 'toolkit', 'download', 'fetch'])
}

function getBuildDuration(data: any): number | undefined {
  const original = data.__original || {}
  const finalResults = original.final_results || {}

  // 优先从 final_results.build 获取
  if (finalResults.build?.duration_seconds) {
    return finalResults.build.duration_seconds
  }

  // 回退到估算值
  return data.build_result?.build_duration_seconds
    ?? data.build_result?.duration_seconds
    ?? data.ttfhw_timeline?.build_duration_seconds
    ?? estimatePhaseDuration(original, ['submodule_init', 'configure', 'cmake', 'ci_build', '编译torchair', 'build', 'cmake_configure', 'make', 'build_repo', 'build_tests', 'build_dockerfile', 'build.sh', 'meson', 'ninja', 'bash build', '编译', 'compile', 'gcc', 'g++', 'source.*build'])
}

function getUtDuration(data: any): number | undefined {
  const original = data.__original || {}
  const finalResults = original.final_results || {}

  // 优先从 final_results.ut 获取
  if (finalResults.ut?.duration_seconds) {
    return finalResults.ut.duration_seconds
  }

  // 回退到估算值
  return data.ut_stats?.ut_duration_seconds
    ?? data.ut_stats?.duration_seconds
    ?? data.ttfhw_timeline?.ut_duration_seconds
    ?? data.ttfhw_timeline?.ut_build_duration_seconds
    ?? estimatePhaseDuration(original, ['ut_script', 'st_script', 'ut_build', '安装wheel包', 'runtime_test', 'inductor_ut', 'inductor_npu_ext', 'ut', 'gtest', 'pytest', 'run_tests', 'test', 'tests', 'unit_test', 'build_tests', 'ctest', 'unittest', 'npu_test', 'run.*test', '测试'])
}

function getSampleDuration(data: any): number | undefined {
  const original = data.__original || {}
  const finalResults = original.final_results || {}

  // 优先从 final_results.sample 获取
  if (finalResults.sample?.duration_seconds) {
    return finalResults.sample.duration_seconds
  }

  // 回退到估算值
  return original.quick_start_analysis?.total_duration_seconds
    ?? original.quick_start_analysis?.duration_seconds
    ?? data.ttfhw_timeline?.quick_start_duration_seconds
    ?? data.ttfhw_timeline?.example_duration_seconds
    ?? estimatePhaseDuration(original, ['sample', 'example', '示例', '样例'])
}

function estimatePhaseDuration(original: any, keywords: string[]): number | undefined {
  return estimateDurationFromEvents(original.process_timeline || [], keywords, ['step', 'action', 'result', 'command'])
    ?? estimateDurationFromEvents(original.execution_log || original.build_execution_log || [], keywords, ['step', 'command', 'output', 'error', 'note', 'action'])
}

function estimateEnvironmentPreparationDuration(events: any[]): number | undefined {
  const sortedEvents = events
    .map(event => ({ event, time: Date.parse(event.timestamp || '') }))
    .filter(item => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time)

  if (sortedEvents.length === 0) return undefined

  const cutoffIndex = sortedEvents.findIndex(({ event }) => isPhaseCutoffEvent(event))
  const cutoffTime = cutoffIndex >= 0 ? sortedEvents[cutoffIndex].time : undefined
  const installKeywords = [
    'clone',
    'docker',
    'pull',
    'container',
    'start',
    '启动',
    'deps',
    'dependency',
    'dependencies',
    'apt-get',
    'apt-get install',
    'pip install',
    'install torch',
    'cann',
    'cann toolkit',
    'toolkit',
    '安装编译依赖',
    '安装pytorch',
    '安装依赖',
    '依赖安装',
    '安装build dependencies',
    '环境',
    'setup',
    'configure',
    'git',
    'safe.directory',
    'update',
    'download',
    'fetch',
  ]

  const totalSeconds = sortedEvents.reduce((sum, item, index) => {
    if (cutoffTime !== undefined && item.time >= cutoffTime) return sum
    if (!matchesEvent(item.event, installKeywords, ['step', 'action', 'command', 'output', 'note'])) return sum

    const nextTime = sortedEvents[index + 1]?.time
    const endTime = cutoffTime !== undefined && nextTime && nextTime > cutoffTime ? cutoffTime : nextTime
    if (!endTime || endTime <= item.time) return sum
    return sum + Math.round((endTime - item.time) / 1000)
  }, 0)

  return totalSeconds > 0 ? totalSeconds : undefined
}

function isPhaseCutoffEvent(event: any): boolean {
  const step = String(event.step || '').toLowerCase()
  const stepTokens = step.split(/[^a-z0-9]+/).filter(Boolean)
  if (stepTokens.some(token => ['configure', 'cmake', 'build', 'ut', 'st', 'runtime', 'sample', 'example', 'compile', 'make', 'meson'].includes(token))) return true

  const command = String(event.command || '').trim().toLowerCase()
  const output = String(event.output || '').trim().toLowerCase()

  return command.startsWith('cmake ')
    || command.includes('&& cmake')
    || command.startsWith('cd build && cmake')
    || command.startsWith('make ')
    || command.includes('&& make ')
    || command.startsWith('bash build.sh')
    || command.includes('./build.sh')
    || command.includes('build.sh')
    || command.includes('pytest')
    || command.includes('unittest')
    || command.includes('ctest')
    || command.includes('gtest')
    || command.startsWith('python3 -c')
    || command.includes('meson setup')
    || command.includes('ninja')
    || output.includes('编译成功')
    || output.includes('build success')
    || output.includes('编译完成')
}

function estimateDurationFromEvents(events: any[], keywords: string[], fields: string[]): number | undefined {
  const sortedEvents = events
    .map(event => ({ event, time: Date.parse(event.timestamp || '') }))
    .filter(item => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time)

  if (sortedEvents.length === 0) return undefined

  const lowerKeywords = keywords.map(keyword => keyword.toLowerCase())
  const matchingIndexes = sortedEvents
    .map((item, index) => matchesEvent(item.event, lowerKeywords, fields) ? index : -1)
    .filter(index => index >= 0)

  if (matchingIndexes.length === 0) return undefined

  // 累加所有匹配事件的时长（每个事件到下一个事件的间隔）
  const totalSeconds = matchingIndexes.reduce((sum, matchIndex) => {
    const start = sortedEvents[matchIndex].time
    const nextEvent = sortedEvents[matchIndex + 1]
    if (!nextEvent) return sum
    const end = nextEvent.time
    if (end <= start) return sum
    return sum + Math.round((end - start) / 1000)
  }, 0)

  return totalSeconds > 0 ? totalSeconds : undefined
}

function matchesEvent(event: any, lowerKeywords: string[], fields: string[]): boolean {
  const haystack = fields.map(field => event[field]).filter(Boolean).join(' ').toLowerCase()
  return lowerKeywords.some(keyword => haystack.includes(keyword))
}

function diffSeconds(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined
  const startTime = Date.parse(start)
  const endTime = Date.parse(end)
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return undefined
  return Math.round((endTime - startTime) / 1000)
}

function sumDisplayPhases(data: any): number {
  const keys = [
    'clone_duration_seconds',
    'docs_reading_estimate_seconds',
    'image_pull_duration_seconds',
    'container_startup_seconds',
    'container_start_duration_seconds',
    'dependency_install_duration_seconds',
    'third_party_build_duration_seconds',
    'megatron_core_install_seconds',
    'meson_setup_duration_seconds',
    'build_duration_seconds',
    'wheel_generation_duration_seconds',
    'ut_build_duration_seconds',
    'ut_duration_seconds',
    'quick_start_duration_seconds',
  ]

  return keys.reduce((sum, key) => sum + (getPhaseDuration(key, data) || 0), 0)
}

function getPhaseDuration(key: string, data: any): number | undefined {
  const timelineValue = data.ttfhw_timeline?.[key]
  if (typeof timelineValue === 'number') return timelineValue

  if (key === 'build_duration_seconds') {
    return data.build_result?.build_duration_seconds ?? data.build_result?.duration_seconds
  }

  if (key === 'ut_duration_seconds') {
    return data.ut_stats?.ut_duration_seconds ?? data.ut_stats?.duration_seconds
  }

  return undefined
}

function addDependencies(target: Dependency[], value: any, type: string) {
  if (!value) return
  if (typeof value === 'number') return
  const items = Array.isArray(value) ? value : [value]
  for (const dep of items) {
    if (!dep) continue
    if (typeof dep === 'string') {
      target.push({ name: dep, type })
    } else if (typeof dep === 'object') {
      target.push({
        name: dep.name || dep.package || dep.provides || dep.url || JSON.stringify(dep),
        version: dep.version,
        type: dep.type || dep.status || dep.source || type,
        source: dep.source || dep.url,
      })
    }
  }
}

function addMissingDependencies(target: (string | MissingDependency)[], value: any) {
  if (!value) return
  const items = Array.isArray(value) ? value : [value]
  for (const dep of items) {
    if (!dep) continue
    if (typeof dep === 'string') {
      target.push(dep)
    } else if (typeof dep === 'object') {
      target.push({ name: dep.name || dep.package || JSON.stringify(dep), reason: dep.reason || dep.message })
    }
  }
}

function summarizeUtFailure(utStats: any, originalUt?: any): string | undefined {
  if (utStats.failure_details) return '存在失败用例'
  if (utStats.failed_tests?.length) return `${utStats.failed_tests.length} 个失败用例`
  if (utStats.crash_pattern) return '测试进程崩溃'
  if (utStats.ut_skipped_reason) return utStats.ut_skipped_reason
  if (originalUt?.note) return originalUt.note
  if (originalUt?.alternative_verification) return originalUt.alternative_verification
  if (utStats.ut_notes) return utStats.ut_notes
  return undefined
}

function detailUtFailure(utStats: any, originalUt?: any): string | undefined {
  if (typeof utStats.failure_details === 'string') return utStats.failure_details
  if (utStats.failure_details) return JSON.stringify(utStats.failure_details)
  if (utStats.failed_tests) return JSON.stringify(utStats.failed_tests)
  if (utStats.crash_pattern) return String(utStats.crash_pattern)
  if (originalUt?.note && originalUt?.alternative_verification) {
    return `${originalUt.note}\n${originalUt.alternative_verification}`
  }
  return undefined
}

function numberOrUndefined(value: any): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

// 从字符串或数字中提取数字值（处理 "300+ (全部)" 这样的字符串）
function extractNumber(value: any): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = value.match(/\d+/)
    return match ? parseInt(match[0], 10) : undefined
  }
  return undefined
}
