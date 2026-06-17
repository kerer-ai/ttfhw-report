import { cn } from '@/lib/utils'

interface BadgeProps {
  status: boolean | string
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ status, label, size = 'sm', className }: BadgeProps) {
  const statusKey = typeof status === 'boolean' ? (status ? 'success' : 'failed') : status
  const displayLabel = label || (typeof status === 'string' ? statusLabel(status) : (status ? '✓' : '✗'))

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  }

  const colorClasses = badgeColor(statusKey)

  return (
    <span className={cn(
      'inline-flex items-center rounded font-medium whitespace-nowrap',
      sizeClasses[size],
      colorClasses,
      className
    )}>
      {displayLabel}
    </span>
  )
}

interface StatusBadgeProps {
  result: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StatusBadge({ result, size = 'md', className }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  }

  return (
    <span className={cn(
      'inline-flex items-center rounded font-medium whitespace-nowrap',
      sizeClasses[size],
      badgeColor(result, true),
      className
    )}>
      {statusLabel(result)}
    </span>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case 'success': return '成功'
    case 'failed': return '失败'
    case 'partial_success': return '部分成功'
    case 'skipped': return '跳过'
    case 'not_run': return '无法执行'
    case 'no_tests': return '无用例'
    case 'timeout': return '超时'
    default: return '未知'
  }
}

function badgeColor(status: string, solid = false): string {
  if (solid) {
    switch (status) {
      case 'success': return 'bg-emerald-600 text-white'
      case 'failed': return 'bg-red-600 text-white'
      case 'partial_success': return 'bg-amber-500 text-white'
      case 'timeout': return 'bg-orange-500 text-white'
      case 'skipped':
      case 'not_run': return 'bg-gray-500 text-white'
      case 'no_tests': return 'bg-slate-500 text-white'
      default: return 'bg-gray-400 text-white'
    }
  }

  switch (status) {
    case 'success': return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'failed': return 'bg-red-50 text-red-700 border border-red-200'
    case 'partial_success': return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'timeout': return 'bg-orange-100 text-orange-700 border border-orange-300'
    case 'skipped':
    case 'not_run':
    case 'no_tests':
    case 'unknown':
    default: return 'bg-gray-100 text-gray-700 border border-gray-300'
  }
}
