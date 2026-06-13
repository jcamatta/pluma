// The navigation seam between the shell's open-files state (owned by App) and the parts of the tree that
// need to switch files without prop-drilling — notably the artifacts panel, which lives deep in the rail
// and must reopen an artifact's file when its card is for a non-active file. Carries the active path (so a
// consumer can tell same-file from cross-file), an `open` command that makes a path the active file, and
// a `close` command that drops a path (and anything under it) when its file is deleted on disk.

import { createContext, useContext } from 'react'
import { invariant } from '../../../shared/invariant'

interface OpenFilesNav {
  readonly activePath: string | null
  readonly open: (path: string) => void
  readonly close: (path: string) => void
}

const OpenFilesContext = createContext<OpenFilesNav | undefined>(undefined)

function useOpenFiles(): OpenFilesNav {
  const value = useContext(OpenFilesContext)
  invariant(value, 'useOpenFiles must be used within an OpenFilesContext provider')
  return value
}

export { OpenFilesContext, useOpenFiles }
export type { OpenFilesNav }
