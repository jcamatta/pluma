// Pure path/entry helpers for the explorer tree. Child paths are reconstructed from the parent path +
// the basename returned by folder:list, using a separator derived from the parent so the strings stay
// identical to the OS-native paths the watcher emits. No IPC, no React: calculations, unit-tested in
// isolation. The tree assembly itself lives in explorer-tree-build.

import type { FolderEntry } from '../../../shared/ipc/ipc-contract/folder'

// Join a parent absolute path with a child basename using the parent's own separator. A Windows path
// (contains a backslash, no forward slash) joins with `\`; everything else joins with `/`. This keeps
// reconstructed child paths string-identical to the native paths folder:changed reports.
function joinPath(parent: string, name: string): string {
  const sep = parent.includes('\\') && !parent.includes('/') ? '\\' : '/'
  const trimmed = parent.endsWith(sep) ? parent.slice(0, parent.length - 1) : parent
  return `${trimmed}${sep}${name}`
}

// The parent directory of an absolute path (everything before the last separator), or null if the path
// has no separator to split on.
function parentPath(path: string): string | null {
  const lastSlash = path.lastIndexOf('/')
  const lastBackslash = path.lastIndexOf('\\')
  const cut = Math.max(lastSlash, lastBackslash)
  return cut <= 0 ? null : path.slice(0, cut)
}

// Sort listed entries the way the design shows them: directories first, then files, each alphabetical
// (case-insensitive), so the rendered tree is stable regardless of readdir order.
function sortEntries(entries: readonly FolderEntry[]): readonly FolderEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export { joinPath, parentPath, sortEntries }
