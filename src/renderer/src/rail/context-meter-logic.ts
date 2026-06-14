// Calculations for the context meter's display: the fill ratio, its rounded percentage, and a compact
// token label ("12.4k", "1.0M"). Kept out of the view so the math is unit-testable without a DOM. Pure.

function contextRatio(usedTokens: number, windowTokens: number): number {
  if (windowTokens <= 0) return 0
  return Math.min(1, Math.max(0, usedTokens / windowTokens))
}

function contextPercent(ratio: number): number {
  return Math.round(ratio * 100)
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

export { contextRatio, contextPercent, formatTokenCount }
