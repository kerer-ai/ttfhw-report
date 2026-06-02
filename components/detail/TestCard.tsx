import { UtStats } from '@/lib/types'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDuration } from '@/lib/utils'
import { TestTube, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'

interface TestCardProps {
  utStats: UtStats
}

export function TestCard({ utStats }: TestCardProps) {
  const passRate = utStats.totalTests && utStats.totalTests > 0
    ? Math.round(((utStats.passed ?? 0) / utStats.totalTests) * 100)
    : undefined

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <TestTube className="w-5 h-5 text-blue-500" />
        单元测试
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 状态 */}
          <div className="flex items-center justify-between">
            <span className="text-gray-600">状态</span>
            <StatusBadge result={utStats.status} />
          </div>

          {/* 测试框架 */}
          {utStats.framework && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">框架</span>
              <span className="font-medium">{utStats.framework}</span>
            </div>
          )}

          {/* 测试总数 */}
          {utStats.totalTests !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">测试总数</span>
              <span className="font-medium">{utStats.totalTests}</span>
            </div>
          )}

          {/* 通过率 */}
          {passRate !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">通过率</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{passRate}%</span>
                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success"
                    style={{ width: `${passRate}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 通过/失败/跳过 */}
          {utStats.totalTests !== undefined && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="flex items-center gap-1 text-success">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">{utStats.passed ?? 0}</span>
                <span className="text-sm text-gray-500">通过</span>
              </div>
              <div className="flex items-center gap-1 text-error">
                <XCircle className="w-4 h-4" />
                <span className="font-medium">{utStats.failed ?? 0}</span>
                <span className="text-sm text-gray-500">失败</span>
              </div>
              <div className="flex items-center gap-1 text-gray-400">
                <span className="font-medium">{utStats.skipped ?? 0}</span>
                <span className="text-sm text-gray-500">跳过</span>
              </div>
            </div>
          )}

          {/* 耗时 */}
          {utStats.durationSeconds && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-gray-600 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                耗时
              </span>
              <span className="font-medium">{formatDuration(utStats.durationSeconds)}</span>
            </div>
          )}

          {/* 错误信息 */}
          {utStats.errorSummary && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700 break-words">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">错误</span>
              </div>
              {utStats.errorSummary}
              {utStats.errorDetail && (
                <div className="mt-2 text-xs text-red-600 overflow-x-auto whitespace-pre-wrap break-all">
                  {utStats.errorDetail.substring(0, 500)}
                  {utStats.errorDetail.length > 500 && '...'}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
