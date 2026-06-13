// Business rule for what the explorer lists: keep every directory (needed to navigate the tree) and
// every Markdown file, dropping any other file. Matching is case-insensitive on the `.md` extension.

import type { FolderEntry } from '../data/entry'

const isMarkdownFile = (entry: FolderEntry): boolean =>
  entry.type === 'directory' || entry.name.toLowerCase().endsWith('.md')

export const keepMarkdownEntries = (
  entries: ReadonlyArray<FolderEntry>
): ReadonlyArray<FolderEntry> => entries.filter(isMarkdownFile)
