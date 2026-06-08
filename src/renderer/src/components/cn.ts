// Class-name helper: `clsx` resolves conditional/array class inputs and `tailwind-merge` collapses
// conflicting Tailwind utilities (so a caller's `className` wins over the base set). Pure calculation.

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: readonly ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export { cn }
export type { ClassValue }
