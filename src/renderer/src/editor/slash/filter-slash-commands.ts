// Narrows the catalog to the items whose keywords contain the typed query (case-insensitive substring).
// An empty query keeps the full list; order follows the catalog. Pure — Suggestion's `items` callback
// delegates here so the live menu and its tests rank identically.

import type { SlashCommandItem } from './slash-command-catalog'

function filterSlashCommands(
  items: readonly SlashCommandItem[],
  query: string
): readonly SlashCommandItem[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return items
  return items.filter((item) =>
    item.keywords.some((keyword) => keyword.toLowerCase().includes(needle))
  )
}

export { filterSlashCommands }
