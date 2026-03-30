/**
 * useConfetti — canvas-confetti wrapper for sprint celebration moments.
 *
 * WHY THIS EXISTS:
 *   Completing a sprint is a ceremony. The team shipped something. Confetti
 *   marks the moment — it's a psychological punctuation that closes the loop
 *   on 1–2 weeks of work. It signals "done" in a way no status badge can.
 *
 * DESIGN DECISIONS:
 *   • Alcon brand palette: deep navy + bright cyan + white midtones
 *   • Twin-cannon launch from bottom corners — directional, not diffuse
 *   • Two-wave timing (0ms + 200ms) — feels like a staggered celebration
 *   • decay: 0.93 + gravity: 0.8 — particles arc up and settle quickly;
 *     no lingering confetti distracting the user from the updated UI
 *   • particleCount: 60 per cannon — visible on all screen sizes,
 *     not so many it tanks performance on integrated GPUs
 *
 * USAGE:
 *   const { fireSprint } = useConfetti()
 *   // Call in onSuccess callback of useCompleteSprint
 *   mutate(sprintId, { onSuccess: fireSprint })
 */

import { useCallback } from 'react'
import confetti from 'canvas-confetti'

/** Alcon brand palette: deep navy, bright cyan, white, mid-blue, ice blue */
const BRAND_COLORS = ['#003595', '#33BBFF', '#ffffff', '#0066cc', '#99ddff']

const CANNON_BASE = {
  particleCount: 60,
  spread:        55,
  startVelocity: 48,
  decay:         0.93,
  gravity:       0.8,
  colors:        BRAND_COLORS,
}

export function useConfetti() {
  /**
   * fireSprint — twin-cannon burst from bottom corners.
   * Left fires immediately; right fires 200ms later for a staggered feel.
   */
  const fireSprint = useCallback(() => {
    // Left cannon — angled up and to the right
    confetti({
      ...CANNON_BASE,
      angle:  60,
      origin: { x: 0, y: 0.85 },
    })

    // Right cannon — angled up and to the left (staggered)
    setTimeout(() => {
      confetti({
        ...CANNON_BASE,
        angle:  120,
        origin: { x: 1, y: 0.85 },
      })
    }, 200)
  }, [])

  return { fireSprint }
}
