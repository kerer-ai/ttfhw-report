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

  // URL 优先使用 repoUrl、repoInfoUrl，回退到 repoPath（当它是 URL 时）
  const repoPathUrl = source.repoPath && /^https?:\/\//.test(source.repoPath) ? source.repoPath : undefined
  const url = source.repoUrl || source.repoInfoUrl || repoPathUrl

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