import { SummaryStats } from '@/lib/types'
import { StatCard } from '@/components/ui/StatCard'
import { formatDuration } from '@/lib/utils'
import { Package, Clock, TestTube, TrendingUp, CheckCircle, Settings } from 'lucide-react'

interface StatsOverviewProps {
  stats: SummaryStats
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        label="仓库总数"
        value={stats.total}
        icon={<Package className="w-8 h-8 text-gray-600" />}
        color="default"
      />
      <StatCard
        label="TTFHW通过率"
        value={
          <>
            <span>{stats.ttfhwPassRate}%</span>
            <span className="text-xs text-slate-500 font-normal block">(通过{stats.success}，部分通过{stats.partial}，失败{stats.failed}{stats.other > 0 ? `，其他${stats.other}` : ''})</span>
          </>
        }
        icon={<TrendingUp className="w-8 h-8 text-success" />}
        color={stats.ttfhwPassRate >= 90 ? 'green' : stats.ttfhwPassRate >= 70 ? 'yellow' : 'red'}
      />
      <StatCard
        label="环境准备平均时长"
        value={formatDuration(stats.avgEnvironmentDuration)}
        icon={<Settings className="w-8 h-8 text-orange-500" />}
        color="orange"
      />
      <StatCard
        label="构建成功率"
        value={`${stats.buildPassRate}%`}
        icon={<CheckCircle className="w-8 h-8 text-success" />}
        color={stats.buildPassRate >= 90 ? 'green' : stats.buildPassRate >= 70 ? 'yellow' : 'red'}
      />
      <StatCard
        label="UT通过率"
        value={`${stats.overallPassRate}%`}
        icon={<TestTube className="w-8 h-8 text-blue-500" />}
        color="blue"
      />
      <StatCard
        label="TTFHW平均时长"
        value={formatDuration(stats.avgDuration)}
        icon={<Clock className="w-8 h-8 text-blue-500" />}
        color="blue"
      />
    </div>
  )
}