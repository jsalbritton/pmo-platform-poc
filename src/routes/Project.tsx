import { useParams } from 'react-router-dom'
import { Folder } from '@phosphor-icons/react'

/**
 * Project — Phase A placeholder.
 * Will become: Project detail with Gantt, Work Items, Risk Score in Sprint 1B.
 * useParams() gives us the project :id from the URL — note how it's typed.
 */
export default function Project() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-pmo-green/10 border border-pmo-green/20">
            <Folder size={40} weight="duotone" style={{ color: '#3fb950' }} />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Project</h1>
        <p className="text-muted-foreground text-sm font-mono">id: {id}</p>
        <p className="text-muted-foreground/60 text-xs">
          Sprint 0 · Phase A · Route active ✓
        </p>
      </div>
    </div>
  )
}
