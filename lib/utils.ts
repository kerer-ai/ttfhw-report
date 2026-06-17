import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) return 'N/A'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${minutes}m ${secs.toFixed(0)}s` : `${minutes}m`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return 'N/A'
  try {
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-success text-white'
    case 'failed':
      return 'bg-error text-white'
    case 'partial_success':
      return 'bg-partial text-white'
    case 'no_tests':
    case 'not_run':
      return 'bg-slate-500 text-white'
    default:
      return 'bg-gray-400 text-white'
  }
}

export function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'success':
      return 'border-l-success'
    case 'failed':
      return 'border-l-error'
    case 'partial_success':
      return 'border-l-partial'
    default:
      return 'border-l-gray-400'
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-50'
    case 'failed':
      return 'bg-red-50'
    case 'partial_success':
      return 'bg-yellow-50'
    default:
      return 'bg-gray-50'
  }
}

// ============================================================
// Repository Community Mapping
// Based on lib/repo-communities.yaml (权威来源)
// ============================================================

const REPO_COMMUNITY_MAP: Record<string, string> = {
  // MindIE
  'mindie-motor': 'MindIE',
  'mindie-sd': 'MindIE',
  'mindie-pymotor': 'MindIE',
  'mindie-llm': 'MindIE',

  // MindSpeed
  'mindspeed': 'MindSpeed',
  'mindspeed-llm': 'MindSpeed',
  'mindspeed-mm': 'MindSpeed',

  // pytorch
  'pytorch': 'PyTorch',
  'op-plugin': 'PyTorch',
  'torchair': 'PyTorch',

  // openeuler
  'kernel': 'openEuler',
  'openeuler-kernel': 'openEuler',
  'isulad': 'openEuler',
  'isula': 'openEuler',
  'a-tune': 'openEuler',
  'stratovirt': 'openEuler',
  'bishengjdk-8': 'openEuler',

  // ubsCore
  'memcache': 'UBSCore',
  'memfabric-hybrid': 'UBSCore',
  'ubs-engine': 'UBSCore',
  'ubs-comm': 'UBSCore',
  'ubs-virt': 'UBSCore',
  'ubs-io': 'UBSCore',
  'ubs-mem': 'UBSCore',
  'omnistatestore': 'UBSCore',
  'ham': 'UBSCore',
  'ubturbo': 'UBSCore',

  // HPCKit
  'kupl': 'HPCKit',
  'kutacc': 'HPCKit',
  'kudnn': 'HPCKit',
  'kuqcd': 'HPCKit',
  'hmpi': 'HPCKit',
  'hucx': 'HPCKit',
  'xucg': 'HPCKit',

  // openubmc
  'libmcpp': 'openUBMC',
  'devmon': 'openUBMC',
  'libipmi': 'openUBMC',
  'component-drivers': 'openUBMC',
  'webui': 'openUBMC',
  'manifest': 'openUBMC',
  'driver2': 'openUBMC',

  // cann
  'ops-nn': 'CANN',
  'ops-math': 'CANN',
  'ops-transformer': 'CANN',
  'ops-cv': 'CANN',
  'opbase': 'CANN',
  'hixl': 'CANN',
  'shmem': 'CANN',
  'hccl': 'CANN',
  'hcomm': 'CANN',
  'ge': 'CANN',
  'metadef': 'CANN',
  'graph-autofusion': 'CANN',
  'asc-devkit': 'CANN',
  'asc-tools': 'CANN',
  'pto-isa': 'CANN',
  'pyasc': 'CANN',
  'pypto': 'CANN',
  'atvoss': 'CANN',
  'runtime': 'CANN',
  'driver': 'CANN',
  'oam-tools': 'CANN',
  'amct': 'CANN',
}

// 仓库名规范化映射
const REPO_NAME_NORMALIZE: Record<string, string> = {
  'amct': 'AMCT',
  'ham': 'HAM',
  'mindspeed': 'MindSpeed',
  'mindspeed-llm': 'MindSpeed-LLM',
  'mindspeed-mm': 'MindSpeed-MM',
  'mindie-motor': 'MindIE-Motor',
  'mindie-sd': 'MindIE-SD',
  'mindie-pymotor': 'MindIE-PyMotor',
  'mindie-llm': 'MindIE-LLM',
  'omnistatestore': 'OmniStateStore',
  'component-drivers': 'component_drivers',
  'memfabric-hybrid': 'memfabric_hybrid',
  'openeuler-kernel': 'kernel',
  'isula': 'iSulad',
}

export interface RepoIdentity {
  repoName: string
  community?: string
  url?: string
}

/**
 * 获取仓库的社区归属
 * 基于 lib/repo-communities.yaml 配置文件
 */
export function getRepoCommunity(repoName: string): string | undefined {
  const key = normalizeRepoKey(repoName)
  return REPO_COMMUNITY_MAP[key]
}

// 仓库 URL 映射（基于 repo-communities.yaml）
const REPO_URL_MAP: Record<string, string> = {
  // MindIE
  'mindie-motor': 'https://gitcode.com/Ascend/MindIE-Motor.git',
  'mindie-sd': 'https://gitcode.com/Ascend/MindIE-SD.git',
  'mindie-pymotor': 'https://gitcode.com/Ascend/MindIE-PyMotor.git',
  'mindie-llm': 'https://gitcode.com/Ascend/MindIE-LLM.git',
  // MindSpeed
  'mindspeed': 'https://gitcode.com/Ascend/MindSpeed.git',
  'mindspeed-llm': 'https://gitcode.com/Ascend/MindSpeed-LLM.git',
  'mindspeed-mm': 'https://gitcode.com/Ascend/MindSpeed-MM.git',
  // pytorch
  'pytorch': 'https://gitcode.com/Ascend/pytorch.git',
  'op-plugin': 'https://gitcode.com/Ascend/op-plugin.git',
  'torchair': 'https://gitcode.com/Ascend/torchair.git',
  // openEuler
  'kernel': 'https://gitcode.com/openeuler/kernel.git',
  'openeuler-kernel': 'https://gitcode.com/openeuler/kernel.git',
  'isulad': 'https://gitcode.com/openeuler/iSulad.git',
  'a-tune': 'https://gitcode.com/openeuler/A-Tune.git',
  'stratovirt': 'https://gitcode.com/openeuler/stratovirt.git',
  'bishengjdk-8': 'https://gitcode.com/openeuler/bishengjdk-8.git',
  // ubsCore
  'memcache': 'https://gitcode.com/Ascend/memcache.git',
  'memfabric-hybrid': 'https://gitcode.com/Ascend/memfabric_hybrid.git',
  'ubs-engine': 'https://gitcode.com/openeuler/ubs-engine.git',
  'ubs-comm': 'https://gitcode.com/openeuler/ubs-comm.git',
  'ubs-virt': 'https://gitcode.com/openeuler/ubs-virt.git',
  'ubs-io': 'https://gitcode.com/openeuler/ubs-io.git',
  'ubs-mem': 'https://gitcode.com/openeuler/ubs-mem.git',
  'omnistatestore': 'https://gitcode.com/openeuler/OmniStateStore.git',
  'ham': 'https://gitcode.com/openeuler/ham.git',
  'ubturbo': 'https://gitcode.com/openeuler/ubturbo.git',
  // HPCKit
  'kupl': 'https://gitcode.com/kunpengcompute/kupl.git',
  'kutacc': 'https://gitcode.com/kunpengcompute/kutacc.git',
  'kudnn': 'https://gitcode.com/kunpengcompute/kudnn.git',
  'kuqcd': 'https://gitcode.com/kunpengcompute/kuqcd.git',
  'hmpi': 'https://gitcode.com/kunpengcompute/hmpi.git',
  'hucx': 'https://gitcode.com/kunpengcompute/hucx.git',
  'xucg': 'https://gitcode.com/kunpengcompute/xucg.git',
  // openUBMC
  'libmcpp': 'https://gitcode.com/openUBMC/libmcpp.git',
  'devmon': 'https://gitcode.com/openUBMC/devmon.git',
  'libipmi': 'https://gitcode.com/openUBMC/libipmi.git',
  'component_drivers': 'https://gitcode.com/openUBMC/component_drivers.git',
  'webui': 'https://gitcode.com/openUBMC/webui.git',
  'manifest': 'https://gitcode.com/openUBMC/manifest.git',
  // CANN
  'ops-nn': 'https://gitcode.com/cann/ops-nn.git',
  'ops-math': 'https://gitcode.com/cann/ops-math.git',
  'ops-transformer': 'https://gitcode.com/cann/ops-transformer.git',
  'ops-cv': 'https://gitcode.com/cann/ops-cv.git',
  'opbase': 'https://gitcode.com/cann/opbase.git',
  'hixl': 'https://gitcode.com/cann/hixl.git',
  'shmem': 'https://gitcode.com/cann/shmem.git',
  'hccl': 'https://gitcode.com/cann/hccl.git',
  'hcomm': 'https://gitcode.com/cann/hcomm.git',
  'ge': 'https://gitcode.com/cann/ge.git',
  'metadef': 'https://gitcode.com/cann/metadef.git',
  'graph-autofusion': 'https://gitcode.com/cann/graph-autofusion.git',
  'asc-devkit': 'https://gitcode.com/cann/asc-devkit.git',
  'asc-tools': 'https://gitcode.com/cann/asc-tools.git',
  'pto-isa': 'https://gitcode.com/cann/pto-isa.git',
  'pyasc': 'https://gitcode.com/cann/pyasc.git',
  'pypto': 'https://gitcode.com/cann/pypto.git',
  'atvoss': 'https://gitcode.com/cann/atvoss.git',
  'runtime': 'https://gitcode.com/cann/runtime.git',
  'driver': 'https://gitcode.com/cann/driver.git',
  'oam-tools': 'https://gitcode.com/cann/oam-tools.git',
  'amct': 'https://gitcode.com/cann/amct.git',
}

/**
 * 获取仓库的 GitCode URL
 * 基于 lib/repo-communities.yaml 配置文件
 */
export function getRepoUrl(repoName: string): string | undefined {
  const key = normalizeRepoKey(repoName)
  return REPO_URL_MAP[key]
}

/**
 * 规范化仓库名称
 * 清理文件名中的前缀、后缀、日期等
 */
export function normalizeRepoName(name: string): string {
  if (!name) return ''

  // 清理前缀和后缀
  let cleaned = name
    .replace(/^verification_report_/, '')
    .replace(/^WSL_/, '')
    .replace(/^Ubuntu_/, '')
    .replace(/_202605\d{2}$/, '')  // 匹配日期后缀
    .replace(/_202605\d{2}_final$/, '')  // 匹配日期+final后缀
    .replace(/\.git$/, '')
    .replace(/^Ascend_/, '')
    .replace(/^openUBMC_/, '')
    .replace(/^cann_/, '')
    .replace(/^openeuler_/, '')
    .replace(/^kunpengcompute_/, '')
    // 清理括号内的描述文字（如 "AMCT (Ascend Model Compression Toolkit)"）
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()

  // 查表规范化
  const key = normalizeRepoKey(cleaned)
  return REPO_NAME_NORMALIZE[key] || cleaned
}

/**
 * 从 JSON 数据中提取仓库身份信息
 */
export function deriveRepoIdentity(source: {
  fallbackName: string
  repoPath?: string
  repoUrl?: string
  repoInfoName?: string
  repoInfoUrl?: string
}): RepoIdentity {
  // 优先使用 repoInfoName（来自 repo_info.name）
  const rawName = source.repoInfoName || source.fallbackName
  const repoName = normalizeRepoName(rawName)

  // 直接从配置表获取社区
  const community = getRepoCommunity(repoName)

  // URL 优先使用 repoUrl、repoInfoUrl，回退到 repoPath（当它是 URL 时），再回退到配置表
  const repoPathUrl = source.repoPath && /^https?:\/\//.test(source.repoPath) ? source.repoPath : undefined
  const url = (source.repoUrl && /^https?:\/\//.test(source.repoUrl) ? source.repoUrl : undefined)
    || (source.repoInfoUrl && /^https?:\/\//.test(source.repoInfoUrl) ? source.repoInfoUrl : undefined)
    || repoPathUrl
    || getRepoUrl(repoName)

  return {
    repoName,
    community,
    url,
  }
}

function normalizeRepoKey(name: string): string {
  return name.toLowerCase().replace(/[-_]/g, '-')
}

export function truncateName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name
  return name.substring(0, maxLength - 3) + '...'
}

export function calculatePassRate(passed: number | undefined, total: number | undefined): number | undefined {
  if (!total || total === 0) return undefined
  return Math.round(((passed ?? 0) / total) * 100)
}