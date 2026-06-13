// Pure path math for a folder rename. Renaming a folder changes the path of the folder itself and of
// every descendant, so the explorer's open-folder set and selected-file path must be rewritten from the
// old subtree root to the new one. No React, no IPC: calculations, unit-tested in isolation. The
// separator handling mirrors explorer-tree (a path is matched on either `/` or `\` so Windows and POSIX
// paths both work).

// A folder rename described as a subtree move from `from` (the old folder path) to `to` (the new one).
type SubtreeRemap = {
  readonly from: string
  readonly to: string
}

// True when `path` is the subtree root itself or a descendant of it — i.e. exactly `root`, or `root`
// followed by a separator. Matching on both separators keeps it correct regardless of OS path style.
function isUnderOrEqual(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`) || path.startsWith(`${root}\\`)
}

// Rewrite `path` from the `from` subtree onto `to`, preserving everything below the root. Paths outside
// the subtree are returned unchanged.
function remapPath(path: string, remap: SubtreeRemap): string {
  return isUnderOrEqual(path, remap.from) ? `${remap.to}${path.slice(remap.from.length)}` : path
}

// Rewrite every open path that falls under the renamed subtree, returning a new Set (paths outside it
// are carried over untouched).
function remapOpenPaths(open: ReadonlySet<string>, remap: SubtreeRemap): ReadonlySet<string> {
  return new Set([...open].map((path) => remapPath(path, remap)))
}

export { isUnderOrEqual, remapPath, remapOpenPaths }
export type { SubtreeRemap }
