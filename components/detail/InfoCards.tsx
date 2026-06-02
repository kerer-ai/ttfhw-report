import { DocumentationChecklist, DependencyInfo } from '@/lib/types'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FileText, BookOpen, Container, Code, Layers, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface DocCardProps {
  documentation: DocumentationChecklist
}

export function DocCard({ documentation }: DocCardProps) {
  const items = [
    { label: 'README', key: 'readmeExists', icon: FileText },
    { label: '安装说明', key: 'readmeHasInstallSection', icon: BookOpen },
    { label: '快速开始', key: 'readmeHasQuickStart', icon: Container },
    { label: '构建文档', key: 'buildGuideExists', icon: Code },
    { label: '贡献指南', key: 'contributingGuideExists', icon: BookOpen },
    { label: 'DevContainer', key: 'devcontainerExists', icon: Container },
    { label: 'Dockerfile', key: 'dockerfileExists', icon: Container },
    { label: 'docs目录', key: 'docsDirectoryExists', icon: Layers },
  ]

  const existingItems = items.filter(item => documentation[item.key as keyof DocumentationChecklist])

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-blue-500" />
        文档完整性
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {items.map(item => {
            const exists = documentation[item.key as keyof DocumentationChecklist]
            const Icon = item.icon
            return (
              <div key={item.key} className="flex items-center gap-2 text-sm">
                {exists ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-300" />
                )}
                <Icon className="w-3 h-3 text-gray-400" />
                <span className={exists ? 'text-gray-700' : 'text-gray-400'}>
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* 完整度 */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">完整度</span>
            <span className="font-medium">
              {existingItems.length}/{items.length} ({Math.round((existingItems.length / items.length) * 100)}%)
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${(existingItems.length / items.length) * 100}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface DepCardProps {
  dependencies?: DependencyInfo
}

export function DepCard({ dependencies }: DepCardProps) {
  if (!dependencies || (!dependencies.totalDependencies && !dependencies.resolvedDependencies && !dependencies.missingDependencies)) {
    return (
      <Card>
        <CardHeader className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-500" />
          依赖信息
        </CardHeader>
        <CardContent>
          <div className="text-gray-500 text-sm">无依赖信息</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-blue-500" />
        依赖信息
      </CardHeader>
      <CardContent>
        {/* 总数 */}
        {dependencies.totalDependencies && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600">依赖总数</span>
            <span className="font-medium">{dependencies.totalDependencies}</span>
          </div>
        )}

        {/* 已解析依赖 */}
        {dependencies.resolvedDependencies && dependencies.resolvedDependencies.length > 0 && (
          <div className="mt-4">
            <div className="text-gray-600 mb-2">已解析依赖</div>
            <ul className="space-y-1 text-sm max-h-40 overflow-y-auto">
              {dependencies.resolvedDependencies.slice(0, 10).map((dep, idx) => (
                <li key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {dep.type && (
                      <span className="text-xs px-1 py-0.5 bg-gray-100 rounded text-gray-500 shrink-0">
                        {dep.type}
                      </span>
                    )}
                    <span className="text-gray-700 break-all">{dep.name}</span>
                  </div>
                  {dep.version && (
                    <span className="text-xs text-gray-500">{dep.version}</span>
                  )}
                </li>
              ))}
              {dependencies.resolvedDependencies.length > 10 && (
                <li className="text-gray-500 text-xs">
                  ... 还有 {dependencies.resolvedDependencies.length - 10} 个
                </li>
              )}
            </ul>
          </div>
        )}

        {/* 缺失依赖 */}
        {dependencies.missingDependencies && dependencies.missingDependencies.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-1 mb-1 text-yellow-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium text-sm">缺失/跳过依赖</span>
            </div>
            <ul className="text-xs text-yellow-600 max-h-32 overflow-y-auto">
              {dependencies.missingDependencies.map((dep, idx) => (
                <li key={idx} className="py-0.5 break-words">
                  {typeof dep === 'string' ? dep : typeof dep === 'object'
                    ? <span>
                        <span className="font-medium">{(dep as any).name || ''}</span>
                        {(dep as any).reason && <span className="text-yellow-500"> - {(dep as any).reason}</span>}
                      </span>
                    : String(dep)
                  }
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
