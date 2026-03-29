import { Gear } from '@phosphor-icons/react'

/**
 * Settings — Phase A placeholder.
 * Will become: SSO config, notification preferences, user preferences (DB06) in Sprint 3.
 */
export default function Settings() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-secondary border border-border">
            <Gear size={40} weight="duotone" className="text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-muted-foreground/60 text-xs">
          Sprint 0 · Phase A · Route active ✓
        </p>
      </div>
    </div>
  )
}
