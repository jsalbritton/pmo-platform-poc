import { UsersThree } from '@phosphor-icons/react'

/**
 * Resources — Phase A placeholder.
 * Will become: Utilization heatmap + per-person allocation grid in Sprint 2B.
 */
export default function Resources() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-pmo-amber/10 border border-pmo-amber/20">
            <UsersThree size={40} weight="duotone" style={{ color: '#d29922' }} />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Resources</h1>
        <p className="text-muted-foreground/60 text-xs">
          Sprint 0 · Phase A · Route active ✓
        </p>
      </div>
    </div>
  )
}
