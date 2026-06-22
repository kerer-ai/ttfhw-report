import { getAllRepoSummaries, calculateSummaryStats } from '@/lib/data-loader'
import { ClientDashboard } from '@/components/summary/ClientDashboard'
import { PipelineSection } from '@/components/summary/PipelineSection'
import Link from 'next/link'

export default function HomePage() {
  const repos = getAllRepoSummaries()
  const stats = calculateSummaryStats(repos)

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-8 xl:px-8">
      {/* 页面标题 */}
      <header className="mb-8 border-b border-slate-200 pb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Build Verification Dashboard
        </h1>
        <p className="text-slate-500 mt-2">
          TTFHW仓库编译验证结果汇总 - {repos.length}个仓库
          <span className="mx-2 text-slate-300">|</span>
          <Link
            href="/share"
            className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
          >
            🤖 AI辅助业务分享
          </Link>
        </p>
      </header>

      {/* 全流程流水线 */}
      <PipelineSection />

      {/* 客户端仪表盘 */}
      <ClientDashboard repos={repos} stats={stats} />
    </main>
  )
}
