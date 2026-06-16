// Builds the tab models the editor strip renders from the open-files state: one entry per open path,
// in order, each labelled by the same basename rule the editor uses elsewhere and carrying that file's
// live pending-suggestion count (0 when none) for the tab badge. Pure data over data — no React, no
// editor — so the strip's contents are testable on their own; the count comes in as a per-path lookup the
// caller derives by running suggestion-list.ts over each open editor. Selection is not modelled here; Base
// UI Tabs derives the active tab from the controlled value.

import { editorFileName } from './editor-file-name-logic'
import type { OpenFiles } from './open-files-logic'

interface EditorTab {
  readonly path: string
  readonly name: string
  readonly pendingCount: number
}

interface BuildEditorTabsInput {
  readonly open: OpenFiles
  readonly fallback: string
  readonly pendingCounts: ReadonlyMap<string, number>
}

function buildEditorTabs({
  open,
  fallback,
  pendingCounts
}: BuildEditorTabsInput): readonly EditorTab[] {
  return open.paths.map((path) => ({
    path,
    name: editorFileName(path, fallback),
    pendingCount: pendingCounts.get(path) ?? 0
  }))
}

export { buildEditorTabs }
export type { EditorTab, BuildEditorTabsInput }
