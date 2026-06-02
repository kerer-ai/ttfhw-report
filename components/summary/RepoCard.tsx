import Link from 'next/link'
import { RepoSummary } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface RepoCardProps {
  repo: RepoSummary
}

export function RepoCard({ repo }: RepoCardProps) {
  const borderColor: Record<string, string> = {
    success: 'border-l-success',
    failed: 'border-l-error',
    partial_success: 'border-l-partial',
    skipped: 'border-l-gray-400',
    not_run: 'border-l-gray-400',
    unknown: 'border-l-gray-400',
  }

  return (
    <Link href={`/${repo.name}`}>
      <Card className={cn(
        'repo-card border-l-4 hover:border-l-4',
        borderColor[repo.result] || borderColor.unknown,
        'cursor-pointer'
      )}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-lg text-gray-800 truncate max-w-[200px]" title={repo.displayName}>
            {repo.displayName}
          </h3>
          <StatusBadge result={repo.result} size="sm" />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <Badge status={repo.buildStatus} label="Build" size="sm" />
          <Badge status={repo.utStatus} label="Test" size="sm" />
          <Badge status={repo.sampleStatus} label="Example" size="sm" />
        </div>

        <div className="flex justify-between items-center text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
            {formatDuration(repo.totalDuration)}
          </span>
          {repo.testTotal !== undefined && repo.testTotal > 0 && (
            <span>
              Tests: {repo.testPassed ?? 0}/{repo.testTotal}
            </span>
          )}
        </div>

        {repo.category && (
          <div className="mt-2 text-xs text-gray-500">
            {repo.category}
          </div>
        )}
      </Card>
    </Link>
  )
}
