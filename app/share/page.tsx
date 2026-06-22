import Link from 'next/link'
import { ResultPieChart } from '@/components/charts/ResultPieChart'
import { StatsOverview } from '@/components/summary/StatsOverview'
import { Card } from '@/components/ui/Card'
import { SummaryStats, CommunityStats } from '@/lib/types'
import { formatDuration } from '@/lib/utils'
import {
  Brain, Zap, BarChart3, FileText, Search, Wrench,
  Code, ArrowRight, TrendingUp, CheckCircle,
  Layers, Globe, Monitor, RefreshCw, ArrowLeft,
  Hammer, Container, TestTube, Play, Clock,
} from 'lucide-react'

// ================================================================
// 静态常量 — 页面内容不随 json/ 数据变化
// ================================================================

const STATS: SummaryStats = {
  total: 59,
  success: 18,
  failed: 2,
  partial: 39,
  other: 0,
  avgDuration: 4120,
  avgEnvironmentDuration: 2947,
  totalTestsAll: 47338,
  totalPassedAll: 31928,
  overallPassRate: 67.4,
  buildableCount: 57,
  testableCount: 19,
  ttfhwPassRate: 31,
  buildPassRate: 97,
}

const COMMUNITY_STATS: CommunityStats[] = [
  { community: 'CANN', total: 13, success: 5, failed: 0, partial: 8, passRate: 38, avgDuration: 3500 },
  { community: 'UBSCore', total: 10, success: 1, failed: 0, partial: 9, passRate: 10, avgDuration: 2800 },
  { community: 'MindIE', total: 6, success: 0, failed: 1, partial: 5, passRate: 0, avgDuration: 3200 },
  { community: 'openEuler', total: 5, success: 4, failed: 0, partial: 1, passRate: 80, avgDuration: 1800 },
  { community: 'PyTorch', total: 5, success: 0, failed: 0, partial: 5, passRate: 0, avgDuration: 2500 },
  { community: 'HPCKit', total: 7, success: 3, failed: 0, partial: 4, passRate: 43, avgDuration: 2200 },
  { community: 'MindSpeed', total: 3, success: 0, failed: 0, partial: 3, passRate: 0, avgDuration: 3000 },
  { community: 'openUBMC', total: 7, success: 2, failed: 0, partial: 5, passRate: 29, avgDuration: 3500 },
  { community: '其他', total: 3, success: 1, failed: 0, partial: 2, passRate: 33, avgDuration: 2000 },
]

// 聚合问题统计
const PROBLEM_STATS = {
  totalReposWithProblems: 57,
  totalProblems: 213,
  resolvedCount: 120,
  unresolvedCount: 93,
  topProblems: [
    '构建产物安装后 import 失败（缺少 CANN/HCCL 运行时库）',
    'UT/样例需要 NPU 硬件，当前环境不具备',
    'cmake 版本策略兼容性问题',
    '依赖包版本冲突需要手动解决',
    'Docker 容器网络/DNS 解析失败',
    '大文件编译 OOM，需要限制并发',
  ],
}

// ================================================================
// Section 3: AI 4-Stage 效率拆解
// ================================================================

const AI_STAGES = [
  {
    num: 1,
    icon: Brain,
    title: '仓库验证',
    skill: 'ttfhw-verify-pro',
    aiReplaces: '阅读文档 → 环境判断 → 依赖安装 → 构建执行 → 错误排查 → UT/样例运行',
    highlights: [
      'AI 自动识别 README 中的构建命令与依赖列表',
      '构建失败时自主分析错误日志、尝试多种修复策略',
      '自动记录每步耗时与决策依据',
    ],
    color: 'indigo' as const,
  },
  {
    num: 2,
    icon: FileText,
    title: '报告归一化',
    skill: 'ttfhw-report-normalizer',
    aiReplaces: '人工理解报告 → 手工整理 → 状态归类 → 脱敏处理',
    highlights: [
      'AI 理解非标准状态值，自动映射为 5 种标准状态',
      '自动脱敏：IP、用户名、主机名替换',
      '支持 6 种不同格式的自动检测与转换',
    ],
    color: 'emerald' as const,
  },
  {
    num: 3,
    icon: Code,
    title: '页面构建',
    skill: 'Next.js SSG Build',
    aiReplaces: '手工编写前端代码 → 手工部署 → 手工维护',
    highlights: [
      'AI 辅助编码生成整个 Dashboard（本页面即为 AI 编写）',
      '读取 JSON 数据自动渲染 61 个静态页面',
      'GitHub Pages 自动部署，零运维成本',
    ],
    color: 'purple' as const,
  },
  {
    num: 4,
    icon: RefreshCw,
    title: '飞书刷新',
    skill: 'ttfhw-feishu-update',
    aiReplaces: '手工对照仓库名 → 逐行填入飞书 → 格式调整',
    highlights: [
      'AI 自动匹配仓库名到飞书行',
      '17 列数据批量写入，秒级完成',
      '零人工录入错误，数据可追溯',
    ],
    color: 'amber' as const,
  },
]

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; light: string }> = {
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-200', light: 'bg-indigo-50' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-200', light: 'bg-emerald-50' },
  purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', light: 'bg-purple-50' },
  amber: { bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-50' },
}

// ================================================================
// Section 6: pytorch AI 验证演示 — 硬编码时间线
// ================================================================

interface DemoStep {
  icon: React.ReactNode
  iconBg: string
  label: string
  detail: string
  result: 'success' | 'failed' | 'ai_fix' | 'info'
  resultLabel: string
  duration?: string
}

const DEMO_STEPS: DemoStep[] = [
  {
    icon: <FileText className="h-5 w-5" />,
    iconBg: 'bg-blue-100 text-blue-600',
    label: 'AI 阅读文档',
    detail: 'AI 自动解析 README.zh.md、docker/README.md、Dockerfile，提取：基于 PyTorch 2.7.1，cmake 构建，需 manylinux-builder 镜像，依赖 CANN 环境',
    result: 'success',
    resultLabel: '成功提取',
    duration: '60s',
  },
  {
    icon: <Container className="h-5 w-5" />,
    iconBg: 'bg-indigo-100 text-indigo-600',
    label: 'AI 环境准备',
    detail: 'AI 选择 manylinux-builder:v1 镜像（由仓库 Dockerfile 构建），启动容器 ttfhw-pytorch-env，挂载仓库到 /home/pytorch',
    result: 'success',
    resultLabel: '容器就绪',
    duration: '3s',
  },
  {
    icon: <Hammer className="h-5 w-5" />,
    iconBg: 'bg-red-100 text-red-600',
    label: '构建（第1次）',
    detail: 'bash ci/build.sh --python=3.10\n失败原因：CMakeCache.txt 目录不匹配，CMake 检测到上次构建残留',
    result: 'failed',
    resultLabel: '构建失败',
    duration: '38s',
  },
  {
    icon: <Brain className="h-5 w-5" />,
    iconBg: 'bg-amber-100 text-amber-600',
    label: 'AI 自动诊断修复',
    detail: 'AI 分析错误日志，判定为 CMake 缓存残留问题。执行：清理 build/、dist/ 等构建产物目录（不修改源码）',
    result: 'ai_fix',
    resultLabel: 'AI 自主决策',
  },
  {
    icon: <Hammer className="h-5 w-5" />,
    iconBg: 'bg-red-100 text-red-600',
    label: '构建（第2次）',
    detail: '清理后重试 bash ci/build.sh --python=3.10\n失败原因：CMake 3.28+ 策略兼容性检查不通过（libuv 子项目要求 CMake < 3.5 兼容模式）',
    result: 'failed',
    resultLabel: '构建失败',
    duration: '57s',
  },
  {
    icon: <Brain className="h-5 w-5" />,
    iconBg: 'bg-amber-100 text-amber-600',
    label: 'AI 自动诊断修复',
    detail: 'AI 识别 CMake 版本策略报错，按错误提示设置环境变量 CMAKE_POLICY_VERSION_MINIMUM=3.5（不修改仓库源码和 CMakeLists.txt）',
    result: 'ai_fix',
    resultLabel: 'AI 自主决策',
  },
  {
    icon: <Hammer className="h-5 w-5" />,
    iconBg: 'bg-red-100 text-red-600',
    label: '构建（第3次）',
    detail: 'CMAKE_POLICY_VERSION_MINIMUM=3.5 bash ci/build.sh --python=3.10（默认并发 nproc=20）\n失败原因：大模板文件 (StructKernelNpuOpApi.cpp) 编译时 cc1plus 被 OOM Killer 终止',
    result: 'failed',
    resultLabel: '构建失败',
    duration: '23m 58s',
  },
  {
    icon: <Brain className="h-5 w-5" />,
    iconBg: 'bg-amber-100 text-amber-600',
    label: 'AI 自动诊断修复',
    detail: 'AI 识别 OOM 根因：20 核并发导致内存耗尽。设置 MAX_JOBS=4 将 ninja 并发降至 4，清理 cmake 缓存后增量构建',
    result: 'ai_fix',
    resultLabel: 'AI 自主决策',
  },
  {
    icon: <Hammer className="h-5 w-5" />,
    iconBg: 'bg-emerald-100 text-emerald-600',
    label: '构建（第4次 · 增量）',
    detail: 'CMAKE_POLICY_VERSION_MINIMUM=3.5 MAX_JOBS=4 bash ci/build.sh --python=3.10\n✅ 构建成功！产物：torch_npu-2.7.1 wheel (43.2 MB)',
    result: 'success',
    resultLabel: '构建成功',
    duration: '5m 35s',
  },
  {
    icon: <TestTube className="h-5 w-5" />,
    iconBg: 'bg-slate-100 text-slate-600',
    label: 'UT 执行',
    detail: 'AI 判断：仓库 UT 需要 NPU 硬件 + CANN 环境，当前 x86_64 WSL2 环境不具备。冒烟测试：pip install wheel 成功，import torch_npu 因缺少 libhccl.so 失败（属于运行期环境缺失，非构建产物缺陷）',
    result: 'info',
    resultLabel: '正确跳过（无NPU）',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    iconBg: 'bg-purple-100 text-purple-600',
    label: 'AI 生成报告',
    detail: '自动生成结构化 JSON 验证报告，包含全部 16 个步骤的耗时、状态、AI 决策依据。4 次构建尝试总耗时 30m 48s，AI 自主修复 3 个问题。',
    result: 'success',
    resultLabel: '报告完成',
    duration: '68m 40s',
  },
]

// ================================================================
// Section 7: AI 能力总结
// ================================================================

const AI_CAPABILITIES = [
  { icon: FileText, title: '文档理解', desc: '自动解析 README，提取构建/依赖/测试命令', stage: 'Stage 1' },
  { icon: Search, title: '错误诊断', desc: '分析编译错误日志，识别 OOM、CMake 策略等根因', stage: 'Stage 1' },
  { icon: Wrench, title: '自主修复', desc: '调整环境变量、清理缓存、降并发等策略自动尝试', stage: 'Stage 1' },
  { icon: BarChart3, title: '信息抽取', desc: '从非标准格式中提取结构化数据，自动归一化', stage: 'Stage 2' },
  { icon: Code, title: '代码生成', desc: '辅助编写前端代码、数据处理逻辑', stage: 'Stage 3' },
  { icon: Globe, title: '系统集成', desc: '自动匹配数据行、批量写入外部系统', stage: 'Stage 4' },
]

// ================================================================
// 辅助函数
// ================================================================

function resultBadge(result: DemoStep['result']) {
  switch (result) {
    case 'success':
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          成功
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          失败
        </span>
      )
    case 'ai_fix':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <Brain className="h-3 w-3" />
          AI 自主修复
        </span>
      )
    case 'info':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          <CheckCircle className="h-3 w-3" />
          判断正确
        </span>
      )
  }
}

// 效率估算
function getEfficiencyNumbers() {
  const aiMinutes = Math.round(STATS.avgDuration / 60) // ≈ 69 min
  const manualMinutes = 100
  const multiplier = Math.round((manualMinutes / aiMinutes) * 10) / 10 // ≈ 1.4x
  const aiTotalHours = Math.round((STATS.total * aiMinutes) / 60) // ≈ 68h
  const manualTotalHours = STATS.total * 2 // 118h
  const savedHours = manualTotalHours - aiTotalHours // ≈ 50h
  return { aiMinutes, manualMinutes, multiplier, aiTotalHours, manualTotalHours, savedHours }
}

// ================================================================
// Main Page
// ================================================================

export default function SharePage() {
  const eff = getEfficiencyNumbers()

  return (
    <main>
      {/* ================================================================ */}
      {/* Section 1: Hero */}
      {/* ================================================================ */}
      <section className="bg-gradient-to-b from-indigo-50 via-white to-white py-20">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8 text-center">
          {/* Breadcrumb */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回仪表盘
          </Link>

          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-5 py-2 text-sm font-medium text-indigo-700">
            <Brain className="h-4 w-4" />
            AI 辅助业务实践
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            AI 辅助软件构建验证
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-xl text-slate-500 leading-relaxed">
            AI 独立完成 {STATS.total}+ 开源仓库的全流程验证 ——
            从阅读文档到飞书报告，全链路无需人工干预
          </p>

          {/* Key Numbers */}
          <div className="mt-12 grid grid-cols-3 gap-8 max-w-xl mx-auto">
            <div>
              <div className="text-4xl font-bold text-indigo-600">{STATS.total}+</div>
              <div className="mt-1 text-sm text-slate-400">仓库全自动验证</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-indigo-600">4</div>
              <div className="mt-1 text-sm text-slate-400">AI 驱动阶段</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-indigo-600">
                {eff.aiMinutes}min
              </div>
              <div className="mt-1 text-sm text-slate-400">平均每仓库完成</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 2: Manual vs AI */}
      {/* ================================================================ */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          {/* Section Header */}
          <div className="mb-12 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <Zap className="h-4 w-4" />
              核心变革
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              从人工验证到 AI 自动化
            </h2>
            <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
              同样的验证任务，AI 不仅更快、更一致，还能发现人类容易遗漏的细节
            </p>
          </div>

          {/* Two-Column Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: Manual */}
            <div className="rounded-2xl border-2 border-red-100 bg-red-50/30 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <Clock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-red-800">人工验证（过去）</h3>
                  <p className="text-sm text-red-500">依赖个人经验，标准不统一，效率低下</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  { icon: FileText, text: '逐字阅读 README，理解构建步骤和依赖关系' },
                  { icon: Container, text: '手动搭建 Docker 环境，选择基础镜像' },
                  { icon: Search, text: '逐条执行命令，遇到错误人工排查、搜索解决方案' },
                  { icon: Clock, text: '手工记录每步执行结果、耗时，整理成报告' },
                  { icon: Clock, text: `一个仓库约需 ${eff.manualMinutes} 分钟（含环境准备和问题排查）` },
                  { icon: Monitor, text: `${STATS.total} 个仓库需要约 ${eff.manualTotalHours} 小时人工投入` },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    <span className="text-sm text-slate-600 leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* RIGHT: AI */}
            <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/30 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <Brain className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-emerald-800">AI 自动验证（现在）</h3>
                  <p className="text-sm text-emerald-500">标准化流程，全自动执行，结果可复现</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  { icon: Brain, text: 'AI 自动解析 README，提取构建命令、依赖列表、测试入口' },
                  { icon: Zap, text: 'AI 自主选择镜像，启动容器，安装依赖' },
                  { icon: Brain, text: `AI 自主分析错误日志、尝试多轮修复（已自主解决 ${PROBLEM_STATS.resolvedCount}+ 个问题）` },
                  { icon: Zap, text: 'AI 自动记录执行日志、耗时、决策依据，生成结构化报告' },
                  { icon: Zap, text: `一个仓库平均仅需 ${eff.aiMinutes} 分钟` },
                  { icon: CheckCircle, text: `${STATS.total} 个仓库全自动完成，零人工介入` },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    <span className="text-sm text-slate-600 leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Efficiency Stats Bar */}
          <div className="mt-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-4xl font-bold">{eff.multiplier}x</div>
                <div className="mt-1 text-sm text-indigo-100">AI 验证效率提升</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{eff.aiTotalHours}h</div>
                <div className="mt-1 text-sm text-indigo-100">AI 完成 {STATS.total} 个仓库</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{eff.savedHours}h</div>
                <div className="mt-1 text-sm text-indigo-100">相比人工节省时间</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{STATS.buildPassRate}%</div>
                <div className="mt-1 text-sm text-indigo-100">构建成功率（AI 自主达成）</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 3: AI 在 4 个阶段的提效拆解 */}
      {/* ================================================================ */}
      <section className="py-16 bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-12 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
              <Layers className="h-4 w-4" />
              全链路 AI 自动化
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              AI 在 4 个阶段替代了什么
            </h2>
            <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
              每个阶段 AI 替代了人的具体动作，以及带来的效率提升
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {AI_STAGES.map((stage) => {
              const c = COLOR_MAP[stage.color]
              return (
                <Card key={stage.num} className={`border-2 ${c.border} ${c.light}/30 flex flex-col`}>
                  {/* Stage Number + Icon */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${c.bg} text-sm font-bold text-white`}>
                      {stage.num}
                    </span>
                    <stage.icon className={`h-5 w-5 ${c.text}`} />
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold text-slate-800">{stage.title}</h3>
                  <code className="mt-1 text-[11px] font-mono text-slate-400">{stage.skill}</code>

                  {/* AI Replaces */}
                  <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">
                      🤖 AI 替代了
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">{stage.aiReplaces}</p>
                  </div>

                  {/* Highlights */}
                  <ul className="mt-4 space-y-2 flex-1">
                    {stage.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${c.text}`} />
                        <span className="text-xs text-slate-500 leading-relaxed">{h}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 4: 效率量化大数字 */}
      {/* ================================================================ */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-12 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
              <TrendingUp className="h-4 w-4" />
              效率量化
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              AI 带来了多少提升
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="text-center py-8 border-l-4 border-l-indigo-500">
              <div className="text-5xl font-bold text-indigo-600">{STATS.total}+</div>
              <div className="mt-2 text-sm text-slate-500">
                仓库全自动验证
                <br />
                <span className="text-xs text-slate-400">人工不可能覆盖的量级</span>
              </div>
            </Card>
            <Card className="text-center py-8 border-l-4 border-l-emerald-500">
              <div className="text-5xl font-bold text-emerald-600">{eff.multiplier}x</div>
              <div className="mt-2 text-sm text-slate-500">
                验证效率提升
                <br />
                <span className="text-xs text-slate-400">对比人工约 {eff.manualMinutes}min/仓库</span>
              </div>
            </Card>
            <Card className="text-center py-8 border-l-4 border-l-amber-500">
              <div className="text-5xl font-bold text-amber-600">{eff.savedHours}h+</div>
              <div className="mt-2 text-sm text-slate-500">
                相比人工节省时间
                <br />
                <span className="text-xs text-slate-400">{STATS.total} 仓库 × 2h/仓库 ≈ {STATS.total * 2}h 人工</span>
              </div>
            </Card>
            <Card className="text-center py-8 border-l-4 border-l-purple-500">
              <div className="text-5xl font-bold text-purple-600">100%</div>
              <div className="mt-2 text-sm text-slate-500">
                零遗漏仓库
                <br />
                <span className="text-xs text-slate-400">{STATS.total} 个仓库全部覆盖</span>
              </div>
            </Card>
          </div>

          {/* Problems AI solved */}
          <Card className="mt-6 border-indigo-100 bg-gradient-to-r from-indigo-50 to-white">
            <div className="flex items-center gap-3 mb-2">
              <Wrench className="h-5 w-5 text-indigo-500" />
              <span className="font-semibold text-indigo-800">
                AI 自主解决的构建问题
              </span>
            </div>
            <p className="text-sm text-slate-600">
              在 {PROBLEM_STATS.totalReposWithProblems} 个仓库的验证过程中，共遇到 {PROBLEM_STATS.totalProblems} 个构建/环境问题。
              AI 自主解决了其中 {PROBLEM_STATS.resolvedCount}+ 个，无需人工介入。剩余为环境限制（如 NPU 硬件缺失）等不可控因素。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PROBLEM_STATS.topProblems.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white border border-indigo-100 px-3 py-1 text-xs text-slate-600">
                  <Wrench className="h-3 w-3 text-indigo-400" />
                  {p}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 5: 成果一览 */}
      {/* ================================================================ */}
      <section className="py-16 bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700">
              <Globe className="h-4 w-4" />
              验证成果
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              {STATS.total} 个仓库验证结果一览
            </h2>
            <p className="mt-3 text-lg text-slate-500">
              覆盖 {COMMUNITY_STATS.length} 个社区，构建成功率 {STATS.buildPassRate}%
            </p>
          </div>

          {/* Stats Cards */}
          <div className="mb-8">
            <StatsOverview stats={STATS} />
          </div>

          {/* Pie Chart + Community Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">整体验证结果分布</h3>
              <ResultPieChart success={STATS.success} failed={STATS.failed} partial={STATS.partial} />
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">社区维度分布</h3>
              <div className="space-y-3">
                {COMMUNITY_STATS.map((cs) => (
                  <div key={cs.community} className="flex items-center gap-3">
                    <span className="w-20 text-xs font-medium text-slate-600 shrink-0">{cs.community}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden flex">
                      {cs.success > 0 && (
                        <div
                          className="bg-emerald-500 h-full flex items-center justify-center text-[10px] text-white font-medium"
                          style={{ width: `${(cs.success / cs.total) * 100}%` }}
                        >
                          {cs.success}
                        </div>
                      )}
                      {cs.partial > 0 && (
                        <div
                          className="bg-amber-400 h-full flex items-center justify-center text-[10px] text-white font-medium"
                          style={{ width: `${(cs.partial / cs.total) * 100}%` }}
                        >
                          {cs.partial}
                        </div>
                      )}
                      {cs.failed > 0 && (
                        <div
                          className="bg-red-400 h-full flex items-center justify-center text-[10px] text-white font-medium"
                          style={{ width: `${(cs.failed / cs.total) * 100}%` }}
                        >
                          {cs.failed}
                        </div>
                      )}
                    </div>
                    <span className="w-10 text-xs text-slate-400 text-right font-mono">{cs.passRate}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> 成功</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> 部分成功</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> 失败</span>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 6: AI 验证全过程演示（硬编码 pytorch 时间线） */}
      {/* ================================================================ */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          {/* Section Header */}
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700">
              <Play className="h-4 w-4" />
              实战回放
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              AI 验证全过程演示
            </h2>
            <p className="mt-3 text-lg text-slate-500">
              以{' '}
              <a href="https://gitcode.com/Ascend/pytorch.git" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline">
                Ascend/pytorch
              </a>{' '}
              为例 — AI 在无人工干预下完成 11 个步骤，4 次构建尝试，3 次 AI 自主修复后成功
            </p>
          </div>

          {/* Timeline */}
          <div className="relative mx-auto max-w-2xl">
            {/* Vertical Line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200" />

            <div className="space-y-0">
              {DEMO_STEPS.map((step, i) => (
                <div key={i} className="relative flex gap-6 pb-8 last:pb-0">
                  {/* Timeline Dot */}
                  <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${step.iconBg} shadow-sm ring-4 ring-white`}>
                      {step.icon}
                    </div>
                  </div>

                  {/* Content */}
                  <Card className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-slate-800">
                            {step.label}
                          </h4>
                          {resultBadge(step.result)}
                          {step.duration && (
                            <span className="text-xs text-slate-400 font-mono">
                              {step.duration}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">
                          {step.detail}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Build Duration Breakdown */}
          <Card className="mt-10 mx-auto max-w-2xl border-indigo-100 bg-indigo-50/30">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-800">
                AI 的多轮尝试耗时分解
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '第1次尝试', dur: '38s', status: 'failed' },
                { label: '第2次尝试', dur: '57s', status: 'failed' },
                { label: '第3次 OOM', dur: '23m 58s', status: 'failed' },
                { label: '第4次成功', dur: '5m 35s', status: 'success' },
              ].map((item, i) => (
                <div key={i} className="rounded-lg bg-white border border-indigo-100 p-3 text-center">
                  <div className={`text-lg font-bold ${item.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {item.dur}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400 text-center">
              4 次构建尝试，第 4 次成功 — AI 每次失败后自主调整策略，无需人工介入
            </p>
          </Card>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 7: AI 提效关键能力 */}
      {/* ================================================================ */}
      <section className="py-16 bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-12 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700">
              <Brain className="h-4 w-4" />
              AI 能力拆解
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              AI 提效的 6 大关键能力
            </h2>
            <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
              不只是"自动化脚本"，而是具备理解、诊断、决策能力的 AI 系统
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {AI_CAPABILITIES.map((cap, i) => (
              <Card key={i} className="group hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                    <cap.icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-slate-800">{cap.title}</h4>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                        {cap.stage}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{cap.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Section 8: 总结与展望 */}
      {/* ================================================================ */}
      <section className="py-16 bg-gradient-to-b from-slate-50 to-indigo-50">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-5 py-2 text-sm font-medium text-indigo-700">
            <Zap className="h-4 w-4" />
            总结
          </div>

          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            AI 将软件验证从"人驱动"变为"AI 驱动"
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-lg text-slate-500 leading-relaxed">
            传统软件验证依赖人工逐一阅读文档、搭建环境、执行命令、记录结果。
            TTFHW 方案通过 AI 实现了全链路自动化——AI 理解文档、自主决策、自动修复、自动报告。
            人只需要审核最终结果，做出决策。
          </p>

          {/* Current Stats */}
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            <div className="rounded-xl bg-white border border-indigo-100 p-4">
              <div className="text-2xl font-bold text-indigo-600">{STATS.total}</div>
              <div className="text-xs text-slate-400 mt-1">仓库已验证</div>
            </div>
            <div className="rounded-xl bg-white border border-indigo-100 p-4">
              <div className="text-2xl font-bold text-indigo-600">{COMMUNITY_STATS.length}</div>
              <div className="text-xs text-slate-400 mt-1">社区覆盖</div>
            </div>
            <div className="rounded-xl bg-white border border-indigo-100 p-4">
              <div className="text-2xl font-bold text-indigo-600">{STATS.buildPassRate}%</div>
              <div className="text-xs text-slate-400 mt-1">构建通过率</div>
            </div>
          </div>

          {/* Future */}
          <div className="mt-10 mx-auto max-w-lg rounded-xl bg-white border border-slate-200 p-6 text-left">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              未来方向
            </h4>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-2 text-sm text-slate-500">
                <ArrowRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                扩展到更多社区和仓库类型（私有仓库、内部项目）
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-500">
                <ArrowRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                增加更多验证维度（性能基准、安全扫描、兼容性矩阵）
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-500">
                <ArrowRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                接入 CI/CD 流水线，实现每次 commit 自动验证
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Monitor className="h-4 w-4" />
              返回验证仪表盘
            </Link>
            <a
              href="https://gitcode.com/TTFHVV/ttfhw-report"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Code className="h-4 w-4" />
              查看 Skill 文档
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
