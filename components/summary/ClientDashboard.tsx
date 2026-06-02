'use client'

import { RepoSummary, SummaryStats } from '@/lib/types'
import { StatsOverview } from '@/components/summary/StatsOverview'
import { RepoTable } from '@/components/summary/RepoTable'
import { Card } from '@/components/ui/Card'
import { ResultPieChart } from '@/components/charts/ResultPieChart'
import { DurationBarChart } from '@/components/charts/DurationBarChart'
import { FilterBar } from '@/components/summary/FilterBar'
import { useState } from 'react'

interface ClientDashboardProps {
  repos: RepoSummary[]
  stats: SummaryStats
}

export function ClientDashboard({ repos, stats }: ClientDashboardProps) {
  const [filteredRepos, setFilteredRepos] = useState<RepoSummary[]>(repos)

  return (
    <>
      {/* 统计卡片 */}
      <StatsOverview stats={stats} />

      {/* 图表区 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-slate-800">结果分布</h2>
          <ResultPieChart
            success={stats.success}
            failed={stats.failed}
            partial={stats.partial}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-base font-semibold text-slate-800">耗时TOP 10</h2>
          <DurationBarChart repos={filteredRepos} topCount={10} />
        </Card>
      </div>

      {/* 筛选栏 */}
      <div className="mt-8">
        <FilterBar repos={repos} onFilter={setFilteredRepos} />
      </div>

      {/* 仓库表格 */}
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <RepoTable repos={filteredRepos} />
      </div>
    </>
  )
}
