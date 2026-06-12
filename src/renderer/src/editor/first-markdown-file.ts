// Picks the file the editor opens into when a workspace is opened: the first markdown file at the root,
// in the same stable order the explorer renders (directories first, then files, alphabetical). Returns
// the basename to open, or null when the root has no markdown file — the caller then shows the empty
// state instead of opening anything. Pure calculation over the listing; no IPC, no React.

import type { FolderEntry } from '../../../shared/ipc/ipc-contract/folder'
import { sortEntries } from '../explorer/explorer-tree'

function firstMarkdownFile(entries: readonly FolderEntry[]): string | null {
  const match = sortEntries(entries).find(
    (entry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.md')
  )
  return match ? match.name : null
}

export { firstMarkdownFile }
