import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * cn() — class name utility used by every shadcn/ui component.
 * Merges Tailwind classes intelligently so conflicting classes
 * (e.g. "p-4 p-6") resolve correctly instead of both being applied.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
