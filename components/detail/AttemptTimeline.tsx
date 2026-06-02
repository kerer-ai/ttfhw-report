'use client'

import { useState } from 'react'
import { Attempt } from '@/lib/types'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDuration } from '@/lib/utils'
import { ChevronDown, ChevronUp, Terminal, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

interface AttemptTimelineProps {
  attempts: Attempt[]
  totalDurationSeconds?: number
}

export function AttemptTimeline({ attempts, totalDurationSeconds }: AttemptTimelineProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const attemptsDuration = attempts.reduce((sum, attempt) => sum + attempt.durationSeconds, 0)
  const timingGap = totalDurationSeconds !== undefined ? totalDurationSeconds - attemptsDuration : undefined

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Terminal className="w-5 h-5 text-blue-500" />
        尝试记录 ({attempts.length})
      </h2>

      {totalDurationSeconds !== undefined && (
        <div className="mb-4 grid grid-cols-1 gap-3 text-sm lg:grid-cols-3">
          <div className="rounded-lg border bg-white p-3">
            <div className="text-gray-500">端到端总耗时</div>
            <div className="mt-1 font-semibold text-gray-800">{formatDuration(totalDurationSeconds)}</div>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <div className="text-gray-500">已记录尝试耗时</div>
            <div className="mt-1 font-semibold text-gray-800">{formatDuration(attemptsDuration)}</div>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <div className="text-gray-500">未逐条记录/口径差额</div>
            <div className="mt-1 font-semibold text-gray-800">
              {timingGap !== undefined ? formatDuration(Math.abs(timingGap)) : 'N/A'}
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 text-sm text-gray-600 leading-6">
        尝试记录只覆盖已结构化记录的关键动作，不保证与端到端总耗时逐项相加相等。差额通常来自等待、排队、环境准备、人工排查、重复验证、日志整理，或报告中按超时窗口记录的总耗时。
      </div>

      <div className="space-y-2">
        {attempts.map((attempt, idx) => (
          <div
            key={idx}
            className="border rounded-lg overflow-hidden"
          >
            {/* 头部：可点击展开 */}
            <div
              className="flex flex-col gap-3 p-3 cursor-pointer hover:bg-gray-50 bg-white lg:flex-row lg:items-center lg:justify-between"
              onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* 序号 */}
                <span className="text-gray-500 text-sm w-6 shrink-0">
                  #{attempt.sequence}
                </span>

                {/* 阶段 */}
                <span className="font-medium text-sm px-2 py-0.5 bg-gray-100 rounded shrink-0">
                  {attempt.phase}
                </span>

                {/* 动作 */}
                <span className="text-gray-700 text-sm truncate min-w-0" title={attempt.action}>
                  {attempt.action}
                </span>

                {/* 结果徽章 */}
                <StatusBadge result={attempt.result} size="sm" />
              </div>

              <div className="flex items-center justify-end gap-3 text-sm text-gray-600 shrink-0">
                {/* 耗时 */}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(attempt.durationSeconds)}
                </span>

                {/* 展开/收起箭头 */}
                {expandedIndex === idx ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* 展开内容 */}
            {expandedIndex === idx && (
              <div className="px-4 pb-4 bg-gray-50 border-t text-sm">
                {/* 命令 */}
                {attempt.command && (
                  <div className="mt-3">
                    <div className="text-gray-600 mb-1 flex items-center gap-1">
                      <Terminal className="w-3 h-3" />
                      命令
                    </div>
                    <code className="block p-2 bg-gray-800 text-green-400 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {attempt.command}
                    </code>
                  </div>
                )}

                {/* 输出 */}
                {attempt.output && (
                  <div className="mt-3">
                    <div className="text-gray-600 mb-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-success" />
                      输出
                    </div>
                    <div className="p-2 bg-green-50 rounded text-green-700 overflow-x-auto whitespace-pre-wrap break-all">
                      {attempt.output.substring(0, 500)}
                      {attempt.output.length > 500 && '...'}
                    </div>
                  </div>
                )}

                {/* 错误 */}
                {attempt.errorMessage && (
                  <div className="mt-3">
                    <div className="text-red-600 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      错误
                    </div>
                    <div className="p-2 bg-red-50 rounded text-red-700 overflow-x-auto whitespace-pre-wrap break-all">
                      {attempt.errorMessage.substring(0, 500)}
                      {attempt.errorMessage.length > 500 && '...'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
