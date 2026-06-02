'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ResultPieChartProps {
  success: number
  failed: number
  partial: number
}

export function ResultPieChart({ success, failed, partial }: ResultPieChartProps) {
  const data = [
    { name: '成功', value: success, color: '#10B981' },
    { name: '部分成功', value: partial, color: '#FBBF24' },
    { name: '失败', value: failed, color: '#EF4444' },
  ].filter(d => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        暂无数据
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`${value} 个仓库`, '数量']}
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}