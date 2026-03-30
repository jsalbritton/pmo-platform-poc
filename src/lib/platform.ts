/**
 * platform.ts — Cross-platform utilities for keyboard shortcuts & display.
 *
 * PROBLEM:
 *   Mac uses ⌘ (Command), Windows/Linux uses Ctrl.
 *   Mac uses ⌥ (Option), Windows/Linux uses Alt.
 *   Mac uses ⇧ (Shift), Windows/Linux uses Shift.
 *   Our UI must show the correct modifier for the user's platform.
 *
 * SOLUTION:
 *   Detect platform once, export helpers that return platform-specific
 *   labels and check platform-specific key events.
 *
 * USAGE:
 *   import { modKey, modLabel, isModKey, formatShortcut } from '@/lib/platform'
 *
 *   // In event handlers:
 *   if (isModKey(e) && e.key === 'k') { ... }
 *
 *   // In UI labels:
 *   <kbd>{formatShortcut('mod+shift+c')}</kbd>  → "⌘⇧C" on Mac, "Ctrl+Shift+C" on Windows
 *
 * WHY NOT navigator.platform?
 *   navigator.platform is deprecated. navigator.userAgentData is the
 *   replacement but only available in Chromium. We use both with a
 *   fallback to navigator.platform for Safari/Firefox compatibility.
 */

// ─── PLATFORM DETECTION ──────────────────────────────────────────────────────

type Platform = 'mac' | 'windows' | 'linux'

function detectPlatform(): Platform {
  // Modern API (Chromium-only, but future-proof)
  if (typeof navigator !== 'undefined' && 'userAgentData' in navigator) {
    const uad = (navigator as any).userAgentData
    if (uad?.platform) {
      const p = uad.platform.toLowerCase()
      if (p.includes('mac'))   return 'mac'
      if (p.includes('win'))   return 'windows'
      return 'linux'
    }
  }

  // Legacy fallback (works everywhere including Safari/Firefox)
  if (typeof navigator !== 'undefined') {
    const p = navigator.platform?.toLowerCase() ?? ''
    if (p.includes('mac'))   return 'mac'
    if (p.includes('win'))   return 'windows'
  }

  return 'linux'  // default — Linux uses same shortcuts as Windows
}

/** Detected platform — evaluated once at module load */
export const platform: Platform = detectPlatform()

/** True if user is on macOS */
export const isMac = platform === 'mac'

/** True if user is on Windows */
export const isWindows = platform === 'windows'

// ─── MODIFIER KEY HELPERS ────────────────────────────────────────────────────

/**
 * Check if the platform modifier key is pressed in a keyboard event.
 *   Mac: metaKey (⌘)
 *   Windows/Linux: ctrlKey
 */
export function isModKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey
}

// ─── DISPLAY LABELS ──────────────────────────────────────────────────────────

/** Platform-specific modifier symbols */
export const MOD_LABEL   = isMac ? '⌘' : 'Ctrl'
export const SHIFT_LABEL = isMac ? '⇧' : 'Shift'
export const ALT_LABEL   = isMac ? '⌥' : 'Alt'
export const ENTER_LABEL = isMac ? '↵' : 'Enter'

/**
 * Format a shortcut string for display on the current platform.
 *
 * Input format (platform-agnostic):
 *   'mod+k'           → "⌘K" (Mac) / "Ctrl+K" (Win)
 *   'mod+shift+c'     → "⌘⇧C" (Mac) / "Ctrl+Shift+C" (Win)
 *   'mod+enter'       → "⌘↵" (Mac) / "Ctrl+Enter" (Win)
 *   'escape'          → "Esc"
 *   'shift+enter'     → "⇧↵" (Mac) / "Shift+Enter" (Win)
 *
 * Mac uses compact symbols (⌘⇧C), Windows uses verbose labels (Ctrl+Shift+C)
 */
export function formatShortcut(combo: string): string {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim())

  if (isMac) {
    // Mac: compact symbol style
    return parts
      .map((p) => {
        switch (p) {
          case 'mod':    return '⌘'
          case 'shift':  return '⇧'
          case 'alt':    return '⌥'
          case 'enter':  return '↵'
          case 'escape': return 'Esc'
          default:       return p.toUpperCase()
        }
      })
      .join('')
  }

  // Windows/Linux: verbose label style
  return parts
    .map((p) => {
      switch (p) {
        case 'mod':    return 'Ctrl'
        case 'shift':  return 'Shift'
        case 'alt':    return 'Alt'
        case 'enter':  return 'Enter'
        case 'escape': return 'Esc'
        default:       return p.toUpperCase()
      }
    })
    .join('+')
}

/**
 * Shortcut hint component data — returns { symbol, label } pairs.
 *
 * USAGE IN JSX:
 *   <kbd className="font-mono">{formatShortcut('mod+enter')}</kbd> save
 *
 * This replaces all hardcoded "⌘↵" strings in the codebase.
 */
