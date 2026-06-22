import { notFound } from 'next/navigation'
import { getRepoDetail, generateStaticParams } from '@/lib/data-loader'
import { Card } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import {
  Clock, Server, Cpu, FileText, Terminal, AlertTriangle,
  CheckCircle, XCircle, Package,
  BookOpen, Wrench, FileSearch
} from 'lucide-react'

export { generateStaticParams }

interface PageProps {
  params: Promise<{ repo: string }>
}

export default async function RepoDetailPage({ params }: PageProps) {
  const { repo } = await params
  const detail = getRepoDetail(repo)

  if (!detail) {
    notFound()
  }

  const metadata = detail.metadata
  const machineSpec = detail.machineSpec
  const docSummary = detail.documentReadingSummary
  const executionLog = detail.executionLog || []
  const processTimeline = detail.processTimeline || []
  const docGaps = detail.documentationGaps || []
  const problems = detail.problemsEncountered || []
  const rawData = detail.rawData

  const durationMinutes = Math.round(detail.totalDuration / 60)

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-8 xl:px-8 space-y-6">
      {/* 头部 */}
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {detail.displayName}
            </h1>
            {detail.url && (
              <a href={detail.url} target="_blank" className="text-sm text-blue-600 hover:underline mt-1 block">
                {detail.url}
              </a>
            )}
          </div>
          <StatusBadge result={detail.result} size="lg" />
        </div>
        {metadata && (
          <div className="mt-3 text-sm text-slate-500 flex gap-4 flex-wrap">
            <span><Clock className="w-4 h-4 inline mr-1" />{metadata.start_time} → {metadata.end_time}</span>
            <span>耗时: {durationMinutes} 分钟</span>
            {metadata.total_steps && <span>步骤: {metadata.total_steps}</span>}
            {metadata.branch && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">分支: {metadata.branch}</span>}
            {metadata.commit && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono">commit: {metadata.commit.substring(0, 8)}</span>}
            {metadata.git_describe && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{metadata.git_describe}</span>}
          </div>
        )}
      </header>

      {/* 状态概览 */}
      <TopOverviewCards detail={detail} rawData={rawData} />

      {/* 机器环境 */}
      {machineSpec && (
        <Card>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" />
            验证环境
          </h2>

          {/* 镜像选择 */}
          {machineSpec.image_source && (
            <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-blue-600">镜像来源</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <MachineEnvItem label="类型" value={machineSpec.image_source.type} />
                <MachineEnvItem label="镜像" value={machineSpec.image_source.image_name} />
                <MachineEnvItem label="选择原因" value={machineSpec.image_source.selection_reason} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 宿主机 */}
            {machineSpec.host_machine && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-500" />
                  宿主机
                </h3>
                <MachineEnvGrid data={machineSpec.host_machine} />
              </div>
            )}

            {/* 容器 */}
            {machineSpec.container && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  容器环境
                </h3>
                <MachineEnvGrid data={machineSpec.container} />
              </div>
            )}
          </div>

          {/* 额外环境信息（NPU、CANN 等） */}
          {(machineSpec.npu_hardware_present !== undefined || machineSpec.cann_environment) && (
            <div className="mt-5 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">附加环境信息</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {machineSpec.npu_hardware_present !== undefined && (
                  <div className="rounded-lg border p-3">
                    <span className="text-xs text-slate-500">NPU 硬件</span>
                    <span className={`ml-2 text-sm font-medium ${machineSpec.npu_hardware_present ? 'text-green-600' : 'text-red-500'}`}>
                      {machineSpec.npu_hardware_present ? '可用' : '不可用'}
                    </span>
                  </div>
                )}
                {machineSpec.cann_environment && (
                  <div className="rounded-lg border p-3">
                    <span className="text-xs text-slate-500">CANN 环境</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(machineSpec.cann_environment).map(([k, v]) => {
                        if (k === 'components_installed') return null
                        return <MachineEnvItem key={k} label={k} value={v} />
                      })}
                    </div>
                    {machineSpec.cann_environment.components_installed && (
                      <div className="mt-2">
                        <span className="text-xs text-slate-500">已安装组件:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {machineSpec.cann_environment.components_installed.map((c: string) => (
                            <span key={c} className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 文档阅读摘要 */}
      {docSummary && (
        <Card>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-500" />
            文档阅读摘要
          </h2>
          <DocumentSummaryView data={docSummary} />
        </Card>
      )}

      {/* 静态分析 (v630): 只要 pre_commit 或 lint_runner 任一存在即展示 */}
      {detail.staticAnalysis && (
        <Card>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-indigo-500" />
            静态分析
          </h2>
          {detail.staticAnalysis.summary && (
            <p className="text-sm text-slate-600 mb-4">{detail.staticAnalysis.summary}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pre-commit */}
            <div className={`rounded-lg border p-3 ${detail.staticAnalysis.pre_commit?.configured ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {detail.staticAnalysis.pre_commit?.configured
                  ? <CheckCircle className="w-4 h-4 text-green-600" />
                  : <XCircle className="w-4 h-4 text-slate-400" />}
                <span className="text-sm font-medium">Pre-commit</span>
              </div>
              {detail.staticAnalysis.pre_commit?.configured ? (
                <div className="mt-1 space-y-1">
                  {detail.staticAnalysis.pre_commit.config_file && (
                    <code className="text-xs bg-white px-2 py-1 rounded block">{detail.staticAnalysis.pre_commit.config_file}</code>
                  )}
                  {detail.staticAnalysis.pre_commit.total_hooks != null && (
                    <div className="grid grid-cols-4 gap-1 mt-2">
                      <MiniMetric label="Hooks总数" value={detail.staticAnalysis.pre_commit.total_hooks} />
                      <MiniMetric label="通过" value={detail.staticAnalysis.pre_commit.passed ?? 0} />
                      <MiniMetric label="失败" value={detail.staticAnalysis.pre_commit.failed ?? 0} />
                      <MiniMetric label="跳过" value={detail.staticAnalysis.pre_commit.skipped ?? 0} />
                    </div>
                  )}
                  {detail.staticAnalysis.pre_commit.status && (
                    <span className="text-xs text-slate-600">状态: {detail.staticAnalysis.pre_commit.status}</span>
                  )}
                  {detail.staticAnalysis.pre_commit.failures && detail.staticAnalysis.pre_commit.failures.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <span className="text-xs font-medium text-red-600">失败 Hook 详情:</span>
                      {detail.staticAnalysis.pre_commit.failures.map((f: any, i: number) => (
                        <div key={i} className="rounded border border-red-200 bg-red-50 p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                            <span className="font-medium text-red-700">{f.hook_name || f.hook_id}</span>
                          </div>
                          {f.error && (
                            <div className="mt-1 text-red-600 ml-5">{f.error}</div>
                          )}
                          {f.file && f.file !== 'N/A' && (
                            <div className="mt-0.5 text-slate-400 ml-5">文件: {f.file}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-500">未配置</span>
              )}
            </div>

            {/* Lint-runner */}
            <div className={`rounded-lg border p-3 ${detail.staticAnalysis.lint_runner?.configured ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {detail.staticAnalysis.lint_runner?.configured
                  ? <CheckCircle className="w-4 h-4 text-green-600" />
                  : <XCircle className="w-4 h-4 text-slate-400" />}
                <span className="text-sm font-medium">Lint-runner</span>
              </div>
              {detail.staticAnalysis.lint_runner?.configured && (
                <div className="mt-1 space-y-1">
                  {detail.staticAnalysis.lint_runner.config_file && (
                    <code className="text-xs bg-white px-2 py-1 rounded block">{detail.staticAnalysis.lint_runner.config_file}</code>
                  )}
                  {detail.staticAnalysis.lint_runner.active_linters && detail.staticAnalysis.lint_runner.active_linters.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-xs text-slate-500">启用规则:</span>
                      {detail.staticAnalysis.lint_runner.active_linters.map((l: string) => (
                        <span key={l} className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">{l}</span>
                      ))}
                    </div>
                  )}
                  {detail.staticAnalysis.lint_runner.status && (
                    <span className={`text-xs ${detail.staticAnalysis.lint_runner.status.includes('通过') || detail.staticAnalysis.lint_runner.status.toLowerCase().includes('ok') ? 'text-green-600' : 'text-red-600'}`}>
                      状态: {detail.staticAnalysis.lint_runner.status}
                    </span>
                  )}
                  {detail.staticAnalysis.lint_runner.duration_seconds != null && detail.staticAnalysis.lint_runner.duration_seconds > 0 && (
                    <span className="text-xs text-slate-500 ml-2">耗时: {detail.staticAnalysis.lint_runner.duration_seconds}s</span>
                  )}
                  {detail.staticAnalysis.lint_runner.result && (
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap break-words">{detail.staticAnalysis.lint_runner.result}</p>
                  )}
                </div>
              )}
              {!detail.staticAnalysis.lint_runner?.configured && (
                <span className="text-xs text-slate-500">未配置</span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Devcontainer (v630) */}
      {detail.devcontainer && (
        <Card>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-500" />
            Devcontainer
          </h2>
          <div className={`rounded-lg border p-4 ${detail.devcontainer.enabled ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {detail.devcontainer.enabled
                ? <CheckCircle className="w-5 h-5 text-green-600" />
                : <XCircle className="w-5 h-5 text-slate-400" />}
              <span className="font-medium text-sm">
                {detail.devcontainer.enabled ? '已配置' : '未配置'}
              </span>
            </div>
            {detail.devcontainer.summary && (
              <p className="text-sm text-slate-600">{detail.devcontainer.summary}</p>
            )}
            {detail.devcontainer.enabled && detail.devcontainer.config_files && detail.devcontainer.config_files.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-slate-500">配置文件:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detail.devcontainer.config_files.map((f: string) => (
                    <code key={f} className="text-xs bg-white px-2 py-1 rounded">{f}</code>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 执行日志 */}
      {executionLog.length > 0 && (
        <Card>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-purple-500" />
            执行日志 ({executionLog.length} 步)
          </h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {executionLog.map((log, i) => (
              <div key={i} className={`p-3 rounded-lg border ${log.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 text-sm">
                  {log.success ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                  <span className="font-medium">{log.step}</span>
                  <span className="text-xs text-slate-400">{log.timestamp}</span>
                </div>
                {log.command && (
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded mt-2 block overflow-x-auto whitespace-pre-wrap break-all">
                    {log.command}
                  </code>
                )}
                {(log.returncode !== undefined || (log as any).duration_seconds !== undefined) && (
                  <div className="flex gap-3 mt-1 text-xs text-slate-400">
                    {log.returncode !== undefined && <span>返回码: {log.returncode}</span>}
                    {(log as any).duration_seconds > 0 && <span>耗时: {(log as any).duration_seconds}s</span>}
                  </div>
                )}
                {log.output && (
                  <div className="text-sm text-slate-600 mt-1">{log.output}</div>
                )}
                {log.error && log.error !== 'unknown' && (
                  <div className="text-sm text-red-600 mt-1 font-medium">错误: {log.error}</div>
                )}
                {log.note && (
                  <div className="text-xs text-slate-500 mt-1 italic">{log.note}</div>
                )}
                <JsonObjectGrid
                  data={omitKeys(log, ['timestamp', 'step', 'command', 'success', 'output', 'error', 'note', 'returncode', 'duration_seconds'])}
                  compact
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 阶段时间线 (优先显示带时长计算的阶段) */}
      {detail.timeline.length > 0 && (
        <PhaseTimelineCard items={detail.timeline} />
      )}

      {/* 过程时间线 (原始步骤日志) */}
      {processTimeline.length > 0 && (
        <ProcessTimelineCard items={processTimeline} />
      )}

      {/* 文档缺失 */}
      {docGaps.length > 0 && (
        <Card>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2 text-orange-600">
            <FileText className="w-5 h-5" />
            文档缺失 ({docGaps.length})
          </h2>
          <div className="space-y-2">
            {docGaps.map((gap, i) => <DocumentationGapCard key={i} gap={gap} index={i} />)}
          </div>
        </Card>
      )}

      {/* 遇到的问题 */}
      {problems.length > 0 && (
        <Card>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-500" />
            遇到的问题 ({problems.length})
          </h2>
          <div className="space-y-3">
            {problems.map((p, i) => (
              <div key={i} className={`p-3 rounded-lg border ${p.resolved ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {p.resolved ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  <span className="font-medium">{p.problem}</span>
                </div>
                {p.solution && <p className="text-sm text-slate-600"><strong>方案:</strong> {p.solution}</p>}
                {p.source && <p className="text-xs text-slate-400"><strong>来源:</strong> {p.source}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {rawData && (
        <Card>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-slate-500" />
            完整 JSON 数据
          </h2>
          <JsonValue value={rawData} defaultOpen />
        </Card>
      )}
    </main>
  )
}

// 子组件

function TopOverviewCards({ detail, rawData }: { detail: any; rawData?: Record<string, any> }) {
  const build = getBuildOverview(detail)
  const ut = getUtOverview(detail)
  const sample = getSampleOverview(detail)
  const overallDuration = detail.metadata?.duration_seconds ?? detail.totalDuration
  const envDuration = getEnvDuration(detail, build, ut, sample)

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <OverviewCard title="TTFHW整体时长" status={detail.result}>
        <MetricValue value={formatDurationDisplay(overallDuration)} />
        <OverviewRow label="开始时间" value={detail.metadata?.start_time} />
        <OverviewRow label="结束时间" value={detail.metadata?.end_time} />
        <OverviewRow label="步骤数" value={detail.metadata?.total_steps} />
      </OverviewCard>

      <OverviewCard title="环境准备" status={envDuration != null && envDuration > 0 ? 'success' : undefined}>
        <OverviewRow label="时长" value={formatDurationDisplay(envDuration)} strong />
        <OverviewRow label="安装的依赖" value={detail.documentReadingSummary?.dependencies?.value} />
        <OverviewRow label="安装命令" value={findCommands(detail.executionLog, ['apt-get', 'pip', 'install', 'dependency', '依赖', 'cann'])} code />
      </OverviewCard>

      <OverviewCard title="Build" status={build.status}>
        <OverviewRow label="时长" value={formatDurationDisplay(build.duration)} strong />
        {build.concurrency != null && <OverviewRow label="并发数" value={`${build.concurrency}`} />}
        <OverviewRow label="构建执行命令" value={build.commands} code />
        {build.durationBreakdown && typeof build.durationBreakdown === 'object' && Object.keys(build.durationBreakdown).length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">耗时分解</div>
            <div className="space-y-1">
              {Object.entries(build.durationBreakdown as Record<string, number>).map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs text-slate-600">
                  <span className="truncate mr-2">{key}</span>
                  <span className="font-mono shrink-0">{formatDurationDisplay(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <OverviewRow label="产物" value={build.artifacts} />
      </OverviewCard>

      <OverviewCard title="UT" status={ut.status}>
        <div className={`grid gap-2 ${ut.skipped > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <MiniMetric label="用例总数" value={ut.total} />
          <MiniMetric label="成功" value={ut.passed} />
          <MiniMetric label="失败" value={ut.failed} />
          {ut.skipped > 0 && <MiniMetric label="跳过" value={ut.skipped} />}
        </div>
        <OverviewRow label="时长" value={formatDurationDisplay(ut.duration)} strong />
        <OverviewRow label="已执行用例通过率" value={ut.passRate} strong />
        <StatusExplanation status={ut.status} note={ut.note} />
        {ut.skipReason && <OverviewRow label="跳过原因" value={ut.skipReason} />}
        <OverviewRow label="UT执行命令" value={ut.commands} code />
      </OverviewCard>

      <OverviewCard title="Sample/Example" status={sample.status}>
        <OverviewRow label="时长" value={formatDurationDisplay(sample.duration)} strong />
        <OverviewRow label="执行命令" value={sample.commands} code />
        {sample.smokeTest && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
            <div className="mb-1 font-medium text-slate-600">产物安装后冒烟测试</div>
            {sample.smokeTest.command && (
              <code className="block overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-900 px-2 py-1 mb-1 text-xs text-slate-50">{sample.smokeTest.command}</code>
            )}
            {sample.smokeTest.status && (
              <div className="text-xs text-slate-700">状态: {sample.smokeTest.status}</div>
            )}
            {sample.smokeTest.interpretation && (
              <div className="text-xs text-slate-600 mt-1">{sample.smokeTest.interpretation}</div>
            )}
          </div>
        )}
      </OverviewCard>
    </div>
  )
}

function getEnvDuration(detail: any, build: any, ut: any, sample: any): number | undefined {
  const metaDuration = detail.metadata?.duration_seconds
  if (!metaDuration) return undefined
  const known = (build.duration ?? 0) + (ut.duration ?? 0) + (sample.duration ?? 0)
  const env = metaDuration - known
  return env > 0 ? env : undefined
}

function OverviewCard({ title, status, children }: { title: string; status?: string; children: React.ReactNode }) {
  const normalizedStatus = normalizeDisplayStatus(status)
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <Badge status={normalizedStatus} size="sm" label={statusText(status)} />
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  )
}

function MetricValue({ value }: { value: any }) {
  return <div className="text-2xl font-semibold tracking-tight text-slate-900">{displayValue(value)}</div>
}

function MiniMetric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{displayValue(value)}</div>
    </div>
  )
}

function StatusExplanation({ status, note }: { status?: string; note?: string }) {
  if (!note && !status?.toLowerCase().includes('partial')) return null
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-800">
      {status?.toLowerCase().includes('partial') && (
        <div className="font-medium">状态说明：部分测试通过，部分测试因环境限制未执行或失败。</div>
      )}
      {note && <div className="mt-1 whitespace-pre-wrap break-words">{note}</div>}
    </div>
  )
}

function OverviewRow({ label, value, code = false, strong = false }: { label: string; value: any; code?: boolean; strong?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      {renderOverviewValue(value, code, strong)}
    </div>
  )
}

function renderOverviewValue(value: any, code: boolean, strong: boolean) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-sm text-slate-400">N/A</span>
  }

  const values = Array.isArray(value) ? value : [value]
  if (code) {
    return (
      <div className="space-y-1">
        {values.map((item, index) => (
          <code key={index} className="block overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-900 px-2 py-1.5 text-xs leading-5 text-slate-50">
            {displayValue(item)}
          </code>
        ))}
      </div>
    )
  }

  if (values.length > 1) {
    return (
      <ul className="space-y-1 text-sm text-slate-700">
        {values.map((item, index) => <li key={index} className="break-words">{displayValue(item)}</li>)}
      </ul>
    )
  }

  return <span className={`${strong ? 'font-semibold text-slate-900' : 'text-slate-700'} whitespace-pre-wrap break-words text-sm`}>{displayValue(values[0])}</span>
}

function getBuildOverview(detail: any) {
  const finalBuild = detail.finalResults?.build || {}
  return {
    status: normalizeStatusString(finalBuild.status),
    duration: finalBuild.duration_seconds,
    commands: firstPresent(
      finalBuild.command,
      detail.documentReadingSummary?.build_commands?.value,
      detail.documentReadingSummary?.build_entry?.value,
      findCommand(detail.executionLog, ['build']),
    ),
    concurrency: finalBuild.concurrency,
    durationBreakdown: finalBuild.duration_breakdown,
    artifacts: normalizeArtifactsForDisplay(finalBuild.artifacts),
  }
}

function getUtOverview(detail: any) {
  const finalUt = detail.finalResults?.ut || {}
  const total = finalUt.total ?? 0
  const passed = finalUt.passed ?? 0
  const failed = finalUt.failed ?? 0
  const skipped = finalUt.skipped ?? 0
  return {
    status: normalizeStatusString(finalUt.status),
    total,
    passed,
    failed,
    skipped,
    duration: finalUt.duration_seconds,
    passRate: formatPassRate(passed, total),
    note: finalUt.note || finalUt.failure_reason,
    commands: firstPresent(
      detail.documentReadingSummary?.ut_commands?.value,
      detail.documentReadingSummary?.ut_entry?.value,
      findCommand(detail.executionLog, ['ut', 'test', 'pytest']),
    ),
    skipReason: finalUt.skip_reason,
  }
}

function getSampleOverview(detail: any) {
  const finalSample = detail.finalResults?.sample || {}
  return {
    status: normalizeStatusString(finalSample.status),
    duration: finalSample.duration_seconds,
    commands: firstPresent(
      detail.documentReadingSummary?.sample_commands?.value,
      findCommand(detail.executionLog, ['sample', 'example']),
    ),
    smokeTest: finalSample.smoke_test_after_install || undefined,
  }
}

function findCommand(logs: any[] = [], keywords: string[]): string | undefined {
  return findCommands(logs, keywords)[0]
}

function findCommands(logs: any[] = [], keywords: string[]): string[] {
  const lowerKeywords = keywords.map(keyword => keyword.toLowerCase())
  const commands = logs.filter(log => {
    const haystack = [log.step, log.command, log.note, log.output].filter(Boolean).join(' ').toLowerCase()
    return lowerKeywords.some(keyword => {
      const re = new RegExp('(^|[^a-z])' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])')
      return re.test(haystack)
    })
  }).map(log => log.command).filter(Boolean)
  return Array.from(new Set(commands))
}

function firstPresent(...values: any[]): any {
  return values.find(value => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0))
}

function normalizeArtifactsForDisplay(artifacts: any): string[] {
  if (!artifacts) return []
  const items = Array.isArray(artifacts) ? artifacts : [artifacts]
  return items.map(item => {
    if (typeof item === 'string') return item
    const name = item.name || item.path || item.type || 'artifact'
    const size = item.size || item.sizeHuman || item.size_human
    return size ? `${name} (${size})` : name
  })
}

function formatPassRate(passed?: number, total?: number): string | undefined {
  if (typeof passed !== 'number' || typeof total !== 'number' || total <= 0) return undefined
  return `${Math.round((passed / total) * 100)}%`
}

function formatDurationDisplay(seconds?: number): string | undefined {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return undefined
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

function normalizeStatusString(status?: string): string {
  if (!status) return 'unknown'
  const lower = status.toLowerCase()
  if (lower === 'skipped') return 'skipped'
  if (lower === 'no_tests') return 'no_tests'
  if (lower.includes('success') && !lower.includes('partial')) return 'success'
  if (lower.includes('partial')) return 'partial_success'
  if (lower.includes('fail') || lower.includes('block') || lower.includes('unsuccessful')) return 'failed'
  if (lower.includes('skip') || lower.includes('not')) return 'not_run'
  return 'unknown'
}

function normalizeDisplayStatus(status?: string): string {
  if (!status) return 'unknown'
  const lower = status.toLowerCase()
  if (lower === 'no_tests') return 'no_tests'
  if (lower.includes('success') && !lower.includes('partial')) return 'success'
  if (lower.includes('partial')) return 'partial_success'
  if (lower.includes('fail') || lower.includes('block')) return 'failed'
  if (lower.includes('skip')) return 'skipped'
  if (lower.includes('not') || lower.includes('n/a')) return 'not_run'
  return status
}

function statusText(status?: string): string {
  const normalized = normalizeDisplayStatus(status)
  switch (normalized) {
    case 'success':
      return '成功'
    case 'partial_success':
      return '部分成功'
    case 'failed':
      return '失败'
    case 'skipped':
      return '跳过'
    case 'not_run':
      return '无法执行'
    case 'no_tests':
      return '无用例'
    case 'unknown':
    default:
      return '未知'
  }
}

function displayValue(value: any): string {
  if (value === undefined || value === null || value === '') return 'N/A'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const DOC_FIELD_LABELS: Record<string, string> = {
  architecture: '架构',
  os_selection: '系统选择',
  os_support: '系统支持',
  dependencies: '依赖',
  explicit_dependencies: '显式依赖',
  build_commands: '构建命令',
  build_entry: '构建入口',
  ut_commands: 'UT 命令',
  ut_entry: 'UT 入口',
  st_commands: 'ST 命令',
  sample_commands: '示例命令',
  cann_prerequisite: 'CANN 前置条件',
}

const DOC_FIELD_ORDER = [
  'architecture',
  'os_selection',
  'os_support',
  'cann_prerequisite',
  'dependencies',
  'explicit_dependencies',
  'build_commands',
  'build_entry',
  'ut_commands',
  'ut_entry',
  'st_commands',
  'sample_commands',
]

const DOC_COMMAND_FIELDS = new Set([
  'build_commands',
  'build_entry',
  'ut_commands',
  'ut_entry',
  'st_commands',
  'sample_commands',
])

function DocumentSummaryView({ data }: { data: Record<string, any> }) {
  const orderedKeys = [
    ...DOC_FIELD_ORDER.filter(key => data[key] !== undefined && data[key] !== null),
    ...Object.keys(data).filter(key => !DOC_FIELD_ORDER.includes(key)),
  ]

  const environmentKeys = orderedKeys.filter(key => ['architecture', 'os_selection', 'os_support', 'cann_prerequisite'].includes(key))
  const dependencyKeys = orderedKeys.filter(key => ['dependencies', 'explicit_dependencies'].includes(key))
  const commandKeys = orderedKeys.filter(key => DOC_COMMAND_FIELDS.has(key))
  const otherKeys = orderedKeys.filter(key => !environmentKeys.includes(key) && !dependencyKeys.includes(key) && !commandKeys.includes(key))

  return (
    <div className="space-y-5">
      {environmentKeys.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {environmentKeys.map(key => (
            <DocSummaryTile key={key} label={DOC_FIELD_LABELS[key] || key} item={data[key]} />
          ))}
        </div>
      )}

      {dependencyKeys.map(key => (
        <DocSummarySection key={key} title={DOC_FIELD_LABELS[key] || key} item={data[key]} />
      ))}

      {commandKeys.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">命令与入口</h3>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {commandKeys.map(key => (
              <DocCommandItem key={key} label={DOC_FIELD_LABELS[key] || key} item={data[key]} />
            ))}
          </div>
        </div>
      )}

      {otherKeys.length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">
            其他文档字段 ({otherKeys.length})
          </summary>
          <div className="mt-3">
            <JsonObjectGrid data={Object.fromEntries(otherKeys.map(key => [key, data[key]]))} compact />
          </div>
        </details>
      )}
    </div>
  )
}

function DocSummaryTile({ label, item }: { label: string; item: any }) {
  const source = getDocSource(item)
  const value = getDocValue(item)

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">
        <DocValue value={value} />
      </div>
      {source && <SourceBadge source={source} />}
    </div>
  )
}

function DocSummarySection({ title, item }: { title: string; item: any }) {
  const source = getDocSource(item)
  const value = getDocValue(item)

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {source && <SourceBadge source={source} inline />}
      </div>
      <DocValue value={value} />
    </div>
  )
}

function DocCommandItem({ label, item }: { label: string; item: any }) {
  const source = getDocSource(item)
  const value = getDocValue(item)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {source && <SourceBadge source={source} inline />}
      </div>
      <DocValue value={value} code />
    </div>
  )
}

function DocValue({ value, code = false }: { value: any; code?: boolean }) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-sm text-slate-400">未提供</span>
  }

  if (Array.isArray(value)) {
    return (
      <ul className="grid grid-cols-1 gap-1.5 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-3">
        {value.map((item, index) => (
          <li key={index} className="rounded border border-slate-200 bg-white px-2 py-1.5">
            {String(item)}
          </li>
        ))}
      </ul>
    )
  }

  if (typeof value === 'object') {
    return <JsonValue value={value} />
  }

  if (code) {
    return (
      <code className="block overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-50">
        {String(value)}
      </code>
    )
  }

  return <span className="whitespace-pre-wrap break-words text-sm text-slate-800">{String(value)}</span>
}

function SourceBadge({ source, inline = false }: { source: string; inline?: boolean }) {
  return (
    <div className={`${inline ? '' : 'mt-2'} text-xs text-slate-500`}>
      来源: <span className="rounded bg-white px-1.5 py-0.5 font-medium text-slate-600 ring-1 ring-slate-200">{source}</span>
    </div>
  )
}

function getDocSource(item: any): string | undefined {
  return item && typeof item === 'object' && !Array.isArray(item) ? item.source : undefined
}

function getDocValue(item: any): any {
  return item && typeof item === 'object' && !Array.isArray(item) && 'value' in item ? item.value : item
}

function DocumentationGapCard({ gap, index }: { gap: any; index: number }) {
  if (typeof gap !== 'object' || gap === null) {
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 rounded bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-800">
            #{index + 1}
          </span>
          <span className="text-sm font-medium text-slate-800">{String(gap)}</span>
        </div>
      </div>
    )
  }

  const title = gap.gap || gap.item || gap.issue || gap.problem || gap.description || `文档缺失 #${index + 1}`
  const severity = gap.severity || gap.impact
  const metaItems = [
    ['组件', gap.component],
    ['分类', gap.category],
    ['位置', gap.location],
    ['来源', gap.source],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')
  const bodyItems = [
    ['说明', gap.description],
    ['详情', gap.detail],
    ['影响', gap.impact && gap.impact !== severity ? gap.impact : undefined],
    ['建议', gap.suggestion || gap.recommendation],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')
  const extra = omitKeys(gap, [
    'gap',
    'item',
    'issue',
    'problem',
    'description',
    'detail',
    'severity',
    'impact',
    'suggestion',
    'recommendation',
    'component',
    'category',
    'location',
    'source',
  ])

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-800">
          #{index + 1}
        </span>
        {severity && (
          <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${gapSeverityClass(String(severity))}`}>
            {String(severity)}
          </span>
        )}
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-6 text-slate-900">{String(title)}</h3>
      </div>

      {metaItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {metaItems.map(([label, value]) => (
            <span key={label} className="rounded bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-orange-100">
              <span className="text-slate-400">{label}: </span>{String(value)}
            </span>
          ))}
        </div>
      )}

      {bodyItems.length > 0 && (
        <div className="mt-3 space-y-2">
          {bodyItems.map(([label, value]) => (
            <div key={label} className="rounded border border-orange-100 bg-white/70 p-2 text-sm">
              <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
              <div className="whitespace-pre-wrap break-words text-slate-700">{String(value)}</div>
            </div>
          ))}
        </div>
      )}

      <JsonObjectGrid data={extra} compact />
    </div>
  )
}

function gapSeverityClass(severity: string): string {
  const normalized = severity.toLowerCase()
  if (normalized.includes('high')) return 'bg-red-100 text-red-700'
  if (normalized.includes('medium') || normalized.includes('moderate')) return 'bg-amber-100 text-amber-700'
  if (normalized.includes('low') || normalized.includes('minor')) return 'bg-yellow-100 text-yellow-700'
  return 'bg-slate-100 text-slate-700'
}

function ProcessTimelineCard({ items }: { items: any[] }) {
  const sortedItems = [...items].sort((a, b) => {
    const at = Date.parse(a.timestamp || '')
    const bt = Date.parse(b.timestamp || '')
    if (Number.isNaN(at) || Number.isNaN(bt)) return 0
    return at - bt
  })

  return (
    <Card>
      <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-orange-500" />
        过程时间线 ({sortedItems.length})
      </h2>
      <div className="relative ml-2 space-y-4 border-l-2 border-slate-200 pl-5">
        {sortedItems.map((item, i) => {
          const result = String(item.result || item.status || 'unknown')
          const tone = timelineTone(result)
          const extra = omitKeys(item, ['timestamp', 'step', 'action', 'result', 'status'])

          return (
            <div key={i} className="relative">
              <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white ${tone.dot}`} />
              <div className={`rounded-lg border p-3 ${tone.panel}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {item.timestamp && (
                    <time className="font-mono text-xs text-slate-500">{item.timestamp}</time>
                  )}
                  {item.step && (
                    <span className="rounded bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-600">{item.step}</span>
                  )}
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone.badge}`}>{result}</span>
                </div>
                {item.action && <div className="mt-2 text-sm font-medium text-slate-800">{item.action}</div>}
                <JsonObjectGrid data={extra} compact />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function PhaseTimelineCard({ items }: { items: any[] }) {
  return (
    <Card>
      <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-orange-500" />
        阶段时间线 ({items.length})
      </h2>
      <div className="relative ml-2 space-y-4 border-l-2 border-slate-200 pl-5">
        {items.map((item, i) => {
          const tone = timelineTone(String(item.status || 'unknown'))
          return (
            <div key={i} className="relative">
              <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white ${tone.dot}`} />
              <div className={`rounded-lg border p-3 ${tone.panel}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{item.phase}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone.badge}`}>{item.status}</span>
                  <span className="font-mono text-xs text-slate-500">{formatSeconds(item.durationSeconds)}</span>
                </div>
                <JsonObjectGrid data={omitKeys(item, ['phase', 'status', 'durationSeconds'])} compact />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'N/A'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

function timelineTone(result: string) {
  if (result.includes('success') || result.includes('resolved')) {
    return {
      dot: 'bg-green-500',
      panel: 'border-green-200 bg-green-50',
      badge: 'bg-green-100 text-green-700',
    }
  }
  if (result.includes('fail') || result.includes('error') || result.includes('blocked')) {
    return {
      dot: 'bg-red-500',
      panel: 'border-red-200 bg-red-50',
      badge: 'bg-red-100 text-red-700',
    }
  }
  return {
    dot: 'bg-slate-400',
    panel: 'border-slate-200 bg-slate-50',
    badge: 'bg-slate-100 text-slate-700',
  }
}

function JsonObjectGrid({ data, compact = false }: { data?: any; compact?: boolean }) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) return null

  return (
    <div className={compact ? 'mt-2 space-y-2 text-xs' : 'space-y-3 text-sm'}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="min-w-0">
          <div className="mb-1 font-medium text-slate-600">{key}</div>
          <JsonValue value={value} />
        </div>
      ))}
    </div>
  )
}

function JsonValue({ value, defaultOpen = false }: { value: any; defaultOpen?: boolean }) {
  if (value === null) return <span className="text-slate-400">null</span>
  if (value === undefined) return <span className="text-slate-400">undefined</span>

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">[]</span>

    return (
      <ol className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="rounded border border-slate-200 bg-white p-2">
            <div className="mb-1 text-xs font-medium text-slate-400">#{index + 1}</div>
            <JsonValue value={item} defaultOpen={defaultOpen} />
          </li>
        ))}
      </ol>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return <span className="text-slate-400">{'{}'}</span>

    return (
      <details open={defaultOpen} className="rounded border border-slate-200 bg-slate-50 p-2">
        <summary className="cursor-pointer text-xs font-medium text-slate-500">
          {entries.length} 个字段
        </summary>
        <div className="mt-2 space-y-2">
          {entries.map(([key, nestedValue]) => (
            <div key={key}>
              <div className="mb-1 font-medium text-slate-600">{key}</div>
              <JsonValue value={nestedValue} defaultOpen={defaultOpen} />
            </div>
          ))}
        </div>
      </details>
    )
  }

  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-700' : 'text-red-700'}>{String(value)}</span>
  }

  if (typeof value === 'number') {
    return <span className="font-mono text-slate-800">{value}</span>
  }

  return (
    <span className="whitespace-pre-wrap break-words text-slate-800">
      {String(value)}
    </span>
  )
}

function omitKeys<T extends Record<string, any>>(value: T | undefined, keys: string[]): Record<string, any> {
  if (!value || typeof value !== 'object') return {}
  const omitted = new Set(keys)
  return Object.fromEntries(Object.entries(value).filter(([key, nestedValue]) => {
    if (omitted.has(key)) return false
    return nestedValue !== undefined && nestedValue !== null && nestedValue !== ''
  }))
}

const MACHINE_ENV_LABELS: Record<string, string> = {
  architecture: '架构',
  cpu_model: 'CPU 型号',
  cpu_cores: 'CPU 核心数',
  memory: '内存',
  disk: '磁盘',
  os: '操作系统',
  docker_version: 'Docker 版本',
  python_version: 'Python 版本',
  kernel: '内核',
  image_name: '镜像名称',
  gcc_version: 'GCC 版本',
  cmake_version: 'CMake 版本',
  meson_version: 'Meson 版本',
  ninja_version: 'Ninja 版本',
  torch_version: 'Torch 版本',
  rust_version: 'Rust 版本',
  cargo_version: 'Cargo 版本',
  note: '备注',
  cann_version: 'CANN 版本',
  cann_install_path: '安装路径',
  bisheng_compiler_version: '毕昇编译器',
  install_status: '安装状态',
  cann_package_source: '安装包来源',
  package_size: '安装包大小',
}

function MachineEnvGrid({ data }: { data: Record<string, any> }) {
  if (!data || typeof data !== 'object') return null
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return <span className="text-sm text-slate-400">无数据</span>
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <span className="text-slate-500">{MACHINE_ENV_LABELS[key] || key}: </span>
          <span className="font-medium text-slate-800 break-words">{displayValue(value)}</span>
        </div>
      ))}
    </div>
  )
}

function MachineEnvItem({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <span className="text-xs text-slate-500">{label}: </span>
      <span className="text-sm font-medium text-slate-800">{displayValue(value)}</span>
    </div>
  )
}

