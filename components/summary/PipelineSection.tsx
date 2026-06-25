'use client'

import { Card } from '@/components/ui/Card'

interface PipelineStage {
  num: number
  skill: string
  title: string
  desc: string
  input: string
  output: string
}

const STAGES: PipelineStage[] = [
  {
    num: 1,
    skill: 'ttfhw-verify-pro',
    title: '仓库验证',
    desc: '模拟新手开发者，从README出发，在容器中完成构建/UT/样例验证',
    input: 'Git仓库 URL',
    output: 'json-org-630/ 原始报告',
  },
  {
    num: 2,
    skill: 'ttfhw-report-normalizer',
    title: 'JSON 归一化',
    desc: '检测格式 → 状态归一化(5种) → 9键模板 → 脱敏处理',
    input: 'json-org-630/ 原始 JSON',
    output: 'json/ 归一化 JSON',
  },
  {
    num: 3,
    skill: 'Next.js SSG Build',
    title: '页面构建部署',
    desc: '读取 json/ → React组件渲染 → 静态HTML → GitHub Pages',
    input: 'json/ 60个报告',
    output: '61个静态 HTML 页面',
  },
  {
    num: 4,
    skill: 'ttfhw-feishu-update',
    title: '飞书表格刷新',
    desc: '提取17列指标 → 动态行匹配 → 批量写入飞书电子表格',
    input: 'json/ 归一化数据',
    output: '飞书 F-V 列 54行',
  },
]

const SKILLS_LINK =
  'https://gitcode.com/TTFHVV/ttfhw-report/blob/main/README.md'

export function PipelineSection() {
  return (
    <Card className="mt-8 border-blue-100 bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            全流程验证流水线
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            覆盖仓库验证 → 归一化 → 页面构建 → 飞书刷新的端到端自动化流程
          </p>
        </div>
        <a
          href={SKILLS_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
        >
          Skill 文档 →
        </a>
      </div>

      {/* Pipeline Stages */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage, i) => (
          <div key={stage.num} className="flex gap-0">
            {/* Stage Card */}
            <div className="relative flex w-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              {/* Stage Number Badge */}
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {stage.num}
                </span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600">
                  {stage.skill}
                </code>
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold text-slate-800">
                {stage.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {stage.desc}
              </p>

              {/* Input / Output */}
              <div className="mt-auto border-t border-slate-100 pt-2">
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="shrink-0 rounded bg-green-50 px-1 py-0.5 font-mono text-green-700">
                    in
                  </span>
                  <span className="truncate text-slate-500">{stage.input}</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px]">
                  <span className="shrink-0 rounded bg-orange-50 px-1 py-0.5 font-mono text-orange-700">
                    out
                  </span>
                  <span className="truncate text-slate-500">{stage.output}</span>
                </div>
              </div>
            </div>

            {/* Arrow between stages (hidden on last) */}
            {i < STAGES.length - 1 && (
              <div className="hidden items-center px-1 xl:flex">
                <svg
                  className="h-5 w-5 text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Data Flow Summary */}
      <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
          <span className="font-medium text-slate-700">数据流:</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            Git仓库
          </span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            json-org-630/ (原始, 60个)
          </span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
            json/ (归一化, 60个)
          </span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />
            docs/ (61 HTML)
          </span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            飞书表格 54行
          </span>
        </div>
      </div>
    </Card>
  )
}
