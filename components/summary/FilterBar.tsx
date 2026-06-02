'use client'

import { useState, useMemo, useEffect } from 'react'
import { RepoSummary } from '@/lib/types'
import { Search, X } from 'lucide-react'

interface FilterBarProps {
  repos: RepoSummary[]
  onFilter: (filtered: RepoSummary[]) => void
}

export function FilterBar({ repos, onFilter }: FilterBarProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortBy, setSortBy] = useState('name')

  const categories = useMemo(() => {
    const cats = new Set(repos.map(r => r.category || 'Other'))
    return Array.from(cats).sort()
  }, [repos])

  const filteredRepos = useMemo(() => {
    let result = repos

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(r =>
        r.name.toLowerCase().includes(term) ||
        r.displayName.toLowerCase().includes(term)
      )
    }

    // 结果过滤
    if (resultFilter) {
      result = result.filter(r => r.result === resultFilter)
    }

    // 分类过滤
    if (categoryFilter) {
      result = result.filter(r =>
        categoryFilter === 'Other' ? !r.category : r.category === categoryFilter
      )
    }

    // 排序
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'duration':
          return b.totalDuration - a.totalDuration
        case 'result':
          // success -> partial -> failed -> skipped/not run -> unknown
          const order: Record<string, number> = {
            success: 0,
            partial_success: 1,
            failed: 2,
            skipped: 3,
            not_run: 3,
            unknown: 4,
          }
          return (order[a.result] ?? 4) - (order[b.result] ?? 4)
        case 'name':
        default:
          return a.displayName.localeCompare(b.displayName)
      }
    })

    return result
  }, [repos, searchTerm, resultFilter, categoryFilter, sortBy])

  useEffect(() => {
    onFilter(filteredRepos)
  }, [filteredRepos, onFilter])

  const clearFilters = () => {
    setSearchTerm('')
    setResultFilter('')
    setCategoryFilter('')
    setSortBy('name')
  }

  const hasFilters = searchTerm || resultFilter || categoryFilter

  return (
    <div className="grid grid-cols-1 gap-3 mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(260px,1fr)_160px_160px_150px_auto_auto] lg:items-center">
      {/* 搜索框 */}
      <div className="relative min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="搜索仓库..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 结果筛选 */}
      <select
        value={resultFilter}
        onChange={(e) => setResultFilter(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">全部结果</option>
        <option value="success">成功</option>
        <option value="partial_success">部分成功</option>
        <option value="failed">失败</option>
      </select>

      {/* 分类筛选 */}
      <select
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">全部分类</option>
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {/* 排序 */}
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="name">按名称排序</option>
        <option value="duration">按耗时排序</option>
        <option value="result">按结果排序</option>
      </select>

      {/* 清除筛选 */}
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <X className="w-4 h-4" />
          清除筛选
        </button>
      )}

      {/* 统计 */}
      <div className="py-2 text-right text-sm text-slate-500 whitespace-nowrap">
        显示 {filteredRepos.length} / {repos.length} 个仓库
      </div>
    </div>
  )
}
