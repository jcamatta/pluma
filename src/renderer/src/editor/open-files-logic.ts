// The set of files the user has opened this session, and which one is active. Each open file keeps a
// mounted editor so its artifacts survive switching away and back, so opening is additive: a file is
// added once and made active, reopening an already-open file just reactivates it. Pure data and
// calculations — no editor, no React — so the open-set is trivially testable on its own.

interface OpenFiles {
  readonly paths: readonly string[]
  readonly active: string | null
}

const noOpenFiles: OpenFiles = { paths: [], active: null }

function openFile(state: OpenFiles, path: string): OpenFiles {
  const paths = state.paths.includes(path) ? state.paths : [...state.paths, path]
  return { paths, active: path }
}

// Opening a tab without stealing focus: append the path (if new) but keep the active file as-is. An
// already-open path returns the same reference so the no-op triggers no re-render.
function openFileInBackground(state: OpenFiles, path: string): OpenFiles {
  if (state.paths.includes(path)) return state
  return { paths: [...state.paths, path], active: state.active }
}

// A path is within an ancestor when it is the ancestor itself or sits below it, regardless of which
// separator the native paths use — so closing a deleted folder also closes the files under it.
function isWithin(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}/`) || path.startsWith(`${ancestor}\\`)
}

function closeFile(state: OpenFiles, path: string): OpenFiles {
  const paths = state.paths.filter((open) => !isWithin(open, path))
  if (paths.length === state.paths.length) return state
  const active =
    state.active !== null && paths.includes(state.active)
      ? state.active
      : (paths[paths.length - 1] ?? null)
  return { paths, active }
}

export { noOpenFiles, openFile, openFileInBackground, closeFile }
export type { OpenFiles }
