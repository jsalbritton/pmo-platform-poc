import { useParams } from 'react-router-dom'
import { Kanban } from '@phosphor-icons/react'

/**
 * Board — Phase A placeholder.
 * Will become: Kanban sprint board with @dnd-kit drag-and-drop in Sprint 1B.
 */
export default function Board() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-pmo-cyan/10 border border-pmo-cyan/20">
            <Kanban size={40} weight="duotone" style={{ color: '#39c5cf' }} />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Sprint Board</h1>
        <p className="text-muted-foreground text-sm font-mono">project: {id}</p>
        <p className="text-muted-foreground/60 text-xs">
          Sprint 0 · Phase A · Route active ✓
        </p>
      </div>
    </div>
  )
}
