// Builds the tab models the editor strip renders from the open-files state: one entry per open path,
// in order, each labelled by the same basename rule the editor uses elsewhere. Pure data over data —
// no React, no editor — so the strip's contents are testable on their own. Selection is not modelled
// here; Base UI Tabs derives the active tab from the controlled value.

import { editorFileName } from './editor-file-name-logic'
import type { OpenFiles } from './open-files-logic'

interface EditorTab {
  readonly path: string
  readonly name: string
}

function buildEditorTabs(open: OpenFiles, fallback: string): readonly EditorTab[] {
  return open.paths.map((path) => ({ path, name: editorFileName(path, fallback) }))
}

export { buildEditorTabs }
export type { EditorTab }
