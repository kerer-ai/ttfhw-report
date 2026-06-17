'use client'

import { RepoSummary } from '@/lib/types'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { formatDuration } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface RepoTableProps {
  repos: RepoSummary[]
}

export function RepoTable({ repos }: RepoTableProps) {
  if (repos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        没有符合条件的仓库
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1400px] table-fixed">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="w-[14%] px-3 py-3 text-left text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">仓库</th>
            <th className="w-[6%] px-3 py-3 text-center text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">结果</th>
            <th className="w-[5%] px-3 py-3 text-center text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">构建</th>
            <th className="w-[5%] px-3 py-3 text-center text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">测试</th>
            <th className="w-[5%] px-3 py-3 text-center text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">示例</th>
            <th className="w-[5%] px-3 py-3 text-center text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">Pre-commit</th>
            <th className="w-[5%] px-3 py-3 text-center text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">Lint-runner</th>
            <th className="w-[5%] px-3 py-3 text-center text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">Devcontainer</th>
            <th className="w-[6%] px-3 py-3 text-right text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">总耗时</th>
            <th className="w-[6%] px-3 py-3 text-right text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">环境准备</th>
            <th className="w-[6%] px-3 py-3 text-right text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">Build时长</th>
            <th className="w-[6%] px-3 py-3 text-right text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">UT时长</th>
            <th className="w-[7%] px-3 py-3 text-right text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">Sample</th>
            <th className="w-[6%] px-3 py-3 text-right text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">UT通过率</th>
            <th className="w-[6%] px-3 py-3 text-right text-xs font-semibold text-slate-600 xl:px-4 xl:text-sm">生成时间</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {repos.map(repo => (
            <tr key={repo.name} className="transition-colors hover:bg-blue-50/40">
              <td className="px-3 py-3 xl:px-4">
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    href={`/${repo.name}`}
                    className="font-medium text-blue-700 break-words hover:text-blue-900"
                  >
                    {repo.displayName}
                  </Link>
                  {repo.url && (
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                {repo.category && (
                  <span className="mt-0.5 text-xs text-slate-500">{repo.category}</span>
                )}
              </td>
              <td className="px-3 py-3 text-center xl:px-4">
                <StatusBadge result={repo.result} size="sm" />
              </td>
              <td className="px-3 py-3 text-center xl:px-4">
                <Badge status={repo.buildStatus} size="sm" />
              </td>
              <td className="px-3 py-3 text-center xl:px-4">
                <Badge status={repo.utStatus} size="sm" />
              </td>
              <td className="px-3 py-3 text-center xl:px-4">
                <Badge status={repo.sampleStatus} size="sm" />
              </td>
              <td className="px-3 py-3 text-center xl:px-4">
                <ConfigBadge status={repo.preCommitStatus} />
              </td>
              <td className="px-3 py-3 text-center xl:px-4">
                <ConfigBadge status={repo.lintRunnerStatus} />
              </td>
              <td className="px-3 py-3 text-center xl:px-4">
                <ConfigBadge status={repo.devcontainerStatus} />
              </td>
              <td className="px-3 py-3 text-right text-xs text-slate-600 xl:px-4 xl:text-sm">
                {formatDuration(repo.totalDuration)}
              </td>
              <DurationCell seconds={repo.environmentDuration} />
              <DurationCell seconds={repo.buildDuration} />
              <DurationCell seconds={repo.utDuration} />
              <DurationCell seconds={repo.sampleDuration} />
              <td className="px-3 py-3 text-right text-xs xl:px-4 xl:text-sm">
                {repo.testTotal && repo.testTotal > 0
                  ? (
                    <span className={repo.testFailed === 0 ? 'text-green-700' : 'text-orange-600'}>
                      {(repo.testPassed ?? 0)}/{repo.testTotal}
                      <span className="text-xs ml-1">
                        ({Math.round(((repo.testPassed ?? 0) / repo.testTotal) * 100)}%)
                      </span>
                    </span>
                  )
                  : (
                    <span className="text-slate-400">-</span>
                  )}
              </td>
              <td className="px-3 py-3 text-right text-xs text-slate-500 xl:px-4">
                {repo.generatedAt.split('T')[0]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 底部统计 */}
      <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
        共 {repos.length} 个仓库
        {repos.some(r => r.buildStatus === 'success' || r.buildStatus === 'partial_success') && (
          <span className="ml-4">
            构建成功: {repos.filter(r => r.buildStatus === 'success' || r.buildStatus === 'partial_success').length}
          </span>
        )}
        {repos.some(r => r.utStatus === 'success' || r.utStatus === 'partial_success') && (
          <span className="ml-4">
            测试通过: {repos.filter(r => r.utStatus === 'success' || r.utStatus === 'partial_success').length}
          </span>
        )}
      </div>
    </div>
  )
}

function DurationCell({ seconds }: { seconds?: number }) {
  return (
    <td className="px-3 py-3 text-right text-xs text-slate-600 xl:px-4 xl:text-sm">
      {typeof seconds === 'number' && Number.isFinite(seconds)
        ? formatDuration(seconds)
        : <span className="text-slate-400">-</span>}
    </td>
  )
}

function ConfigBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    configured: { label: '✓', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    not_configured: { label: '✗', className: 'bg-red-50 text-red-400 border border-red-200' },
    unknown: { label: '-', className: 'bg-gray-50 text-gray-300 border border-gray-200' },
  }
  const c = config[status] || config.unknown
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${c.className}`}>
      {c.label}
    </span>
  )
}
