'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { RepoSummary } from '@/lib/types'
import { formatDuration, truncateName } from '@/lib/utils'

interface DurationBarChartProps {
  repos: RepoSummary[]
  topCount?: number
}

export function DurationBarChart({ repos, topCount = 10 }: DurationBarChartProps) {
  // 按耗时排序取TOP N
  const data = repos
    .filter(r => r.totalDuration > 0)
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .slice(0, topCount)
    .map(r => ({
      name: truncateName(r.displayName, 15),
      fullName: r.displayName,
      duration: Math.round(r.totalDuration / 60), // 转换为分钟
      result: r.result,
    }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        暂无数据
      </div>
    )
  }

  const getBarColor = (result: string) => {
    switch (result) {
      case 'success': return '#10B981'
      case 'failed': return '#EF4444'
      case 'partial_success': return '#FBBF24'
      default: return '#6B7280'
    }
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(320, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => `${v}m`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value: number, name: string, props: any) => [
            formatDuration(props.payload.duration * 60),
            '耗时'
          ]}
          labelFormatter={(label) => data.find(d => d.name === label)?.fullName || label}
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        />
        <Bar
          dataKey="duration"
          radius={[0, 4, 4, 0]}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.result)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
