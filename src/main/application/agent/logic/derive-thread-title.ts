// Calculation: derive a thread's default title from its first user message. Collapses runs of
// whitespace, trims, and truncates to a single readable line with an ellipsis. An empty or
// whitespace-only message yields an empty string, which the renderer replaces with a localized
// fallback — the backend never authors user-facing prose. Pure, so it is trivially testable.

const MAX_LENGTH = 60

export const deriveThreadTitle = (firstUserMessage: string): string => {
  const normalized = firstUserMessage.replace(/\s+/g, ' ').trim()
  if (normalized.length <= MAX_LENGTH) return normalized
  return `${normalized.slice(0, MAX_LENGTH).trimEnd()}…`
}
