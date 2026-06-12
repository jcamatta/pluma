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

export { noOpenFiles, openFile }
export type { OpenFiles }
