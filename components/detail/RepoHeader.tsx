import Link from 'next/link'
import { RepoDetail } from '@/lib/types'
import { StatusBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft, ExternalLink, Clock, Server, GitBranch } from 'lucide-react'

interface RepoHeaderProps {
  detail: RepoDetail
}

export function RepoHeader({ detail }: RepoHeaderProps) {
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* 左侧：返回按钮 + 基本信息 */}
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <Link href="/" className="text-gray-500 hover:text-gray-700 shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 break-words">
              {detail.displayName}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-600">
              {detail.url && (
                <a href={detail.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1 hover:text-blue-600 min-w-0 max-w-full">
                  <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-all">{detail.url}</span>
                </a>
              )}
              {detail.branch && (
                <span className="flex items-center gap-1">
                  <GitBranch className="w-4 h-4" />
                  {detail.branch}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDateTime(detail.generatedAt)}
              </span>
              {detail.environment !== 'unknown' && (
                <span className="flex items-center gap-1">
                  <Server className="w-4 h-4" />
                  {detail.environment === 'local' ? '本地环境' : '远程环境'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：状态 */}
        <div className="shrink-0">
          <StatusBadge result={detail.result} size="lg" />
        </div>
      </div>
    </Card>
  )
}
