import { TimelinePhase } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface TimelineCardProps {
  timeline: TimelinePhase[]
}

export function TimelineCard({ timeline }: TimelineCardProps) {
  const phases = timeline.filter(p => p.durationSeconds > 0)
  const totalDuration = phases.reduce((sum, p) => sum + p.durationSeconds, 0)
  const unclassified = phases.find(p => p.phase === '未归类耗时')

  return (
    <Card className="mt-6">
      <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
          ⏱
        </span>
        TTFHW 时间线
      </h2>

      <div className="mb-4 text-sm text-gray-600 leading-6">
        整体耗时按 TTFHW 启动到结束的端到端时间统计。可拆分阶段展示在下方；未能归入标准阶段的等待、重试、环境切换或人工排查时间会计入未归类耗时，具体动作见下方尝试记录。
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
        {phases.map((phase, idx) => (
          <div key={idx} className="min-w-0">
            {/* 阶段节点 */}
            <div className={cn(
              'px-3 py-2 rounded-lg text-sm flex flex-col items-center min-h-[64px] justify-center',
              phase.status === 'success' ? 'bg-green-50 border border-green-200' :
              phase.status === 'failed' ? 'bg-red-50 border border-red-200' :
              'bg-gray-50 border border-gray-200'
            )}>
              <span className="font-medium text-gray-700 text-center break-words">{phase.phase}</span>
              <span className="text-xs text-gray-500">{formatDuration(phase.durationSeconds)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 总耗时 */}
      {phases.length > 0 && (
        <div className="mt-4 pt-4 border-t text-sm text-gray-600 space-y-1">
          <div>端到端总耗时: {formatDuration(totalDuration)}</div>
          {unclassified && (
            <div className="text-gray-500">
              未归类耗时: {formatDuration(unclassified.durationSeconds)}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
