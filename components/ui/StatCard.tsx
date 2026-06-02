import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  color?: 'default' | 'green' | 'red' | 'yellow' | 'blue' | 'orange'
  className?: string
}

export function StatCard({ label, value, icon, color = 'default', className }: StatCardProps) {
  const colorClasses = {
    default: 'bg-white border-slate-200',
    green: 'bg-white border-success/40',
    red: 'bg-white border-error/40',
    yellow: 'bg-white border-partial/50',
    blue: 'bg-white border-blue-300',
    orange: 'bg-white border-orange-300',
  }

  return (
    <div className={cn(
      'rounded-lg border p-3 sm:p-4 flex items-center justify-between gap-3 min-w-0 shadow-sm',
      colorClasses[color],
      className
    )}>
      <div className="min-w-0">
        <div className="text-xs sm:text-sm text-slate-500 truncate">{label}</div>
        {typeof value === 'string' || typeof value === 'number' ? (
          <div className="text-xl sm:text-2xl font-semibold text-slate-900 truncate">{value}</div>
        ) : (
          <div className="text-xl sm:text-2xl font-semibold text-slate-900">{value}</div>
        )}
      </div>
      {icon && (
        <div className="shrink-0 opacity-70 scale-75 sm:scale-100 origin-right">{icon}</div>
      )}
    </div>
  )
}
