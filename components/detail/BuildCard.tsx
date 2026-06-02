import { BuildResult as BuildResultType } from '@/lib/types'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDuration } from '@/lib/utils'
import { Hammer, Package, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface BuildCardProps {
  buildResult: BuildResultType
}

export function BuildCard({ buildResult }: BuildCardProps) {
  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Hammer className="w-5 h-5 text-blue-500" />
        构建结果
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 状态 */}
          <div className="flex items-center justify-between">
            <span className="text-gray-600">状态</span>
            <StatusBadge result={buildResult.status} />
          </div>

          {/* 耗时 */}
          {buildResult.durationSeconds && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">耗时</span>
              <span className="font-medium">{formatDuration(buildResult.durationSeconds)}</span>
            </div>
          )}

          {/* 目标数量 */}
          {buildResult.targetsCount && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">编译目标</span>
              <span className="font-medium">{buildResult.progress || `${buildResult.targetsCount} targets`}</span>
            </div>
          )}

          {/* 构建产物 */}
          {buildResult.artifacts && buildResult.artifacts.length > 0 && (
            <div className="mt-4">
              <div className="text-gray-600 mb-2 flex items-center gap-1">
                <Package className="w-4 h-4" />
                构建产物 ({buildResult.artifacts.length})
              </div>
              <ul className="space-y-1 text-sm">
                {buildResult.artifacts.slice(0, 10).map((artifact, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-gray-700">
                    {buildResult.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <XCircle className="w-4 h-4 text-error" />
                    )}
                    <span className="break-all">{artifact.name}</span>
                    {artifact.sizeHuman && (
                      <span className="text-gray-500 text-xs">{artifact.sizeHuman}</span>
                    )}
                  </li>
                ))}
                {buildResult.artifacts.length > 10 && (
                  <li className="text-gray-500 text-xs">
                    ... 还有 {buildResult.artifacts.length - 10} 个产物
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* 错误信息 */}
          {buildResult.error && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700 break-words">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">错误</span>
              </div>
              {typeof buildResult.error === 'string'
                ? buildResult.error
                : typeof buildResult.error === 'object'
                  ? (buildResult.error as any).message || JSON.stringify(buildResult.error)
                  : String(buildResult.error)
              }
            </div>
          )}

          {/* 构建命令 */}
          {buildResult.buildCommand && (
            <div className="mt-4">
              <div className="text-gray-600 mb-1">构建命令</div>
              <code className="block p-2 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
                {buildResult.buildCommand}
              </code>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
