import { Brain } from '@phosphor-icons/react'

/**
 * AIEngine — Phase A placeholder.
 * Will become: AI risk briefing, sprint planner, project creation,
 * and autonomous agent surfaces in Sprint 2A.
 */
export default function AIEngine() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-pmo-violet/10 border border-pmo-violet/20">
            <Brain size={40} weight="duotone" style={{ color: '#bc8cff' }} />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">AI Engine</h1>
        <p className="text-muted-foreground/60 text-xs">
          Sprint 0 · Phase A · Route active ✓
        </p>
      </div>
    </div>
  )
}
