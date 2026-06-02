import { RepoSummary } from '@/lib/types'
import { RepoCard } from './RepoCard'

interface RepoGridProps {
  repos: RepoSummary[]
}

export function RepoGrid({ repos }: RepoGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {repos.map(repo => (
        <RepoCard key={repo.name} repo={repo} />
      ))}
    </div>
  )
}