// Shared prop/types for the explorer view and its row components, kept in one module so Explorer.view
// and ExplorerRows.view agree on the same shapes without a circular import.

// One node in the rendered tree. `children === undefined` means a folder whose contents have not been
// loaded yet (lazy listing); an empty array means a loaded, empty folder. Files never have children.
type TreeNodeModel = {
  readonly path: string
  readonly name: string
  readonly type: 'file' | 'directory'
  readonly open?: boolean
  readonly children?: readonly TreeNodeModel[]
}

// A node being named: the inline input shown for a freshly created file/folder before it has a name.
type DraftNode = {
  readonly parentPath: string | null
  readonly type: 'file' | 'directory'
}

// All UI strings resolved by the controller (views may not call the i18n hook).
type ExplorerLabels = {
  readonly title: string
  readonly newFile: string
  readonly newFolder: string
  readonly deleteFile: string
  readonly deleteFolder: string
  readonly renameFile: string
  readonly renameFolder: string
  readonly collapse: string
  readonly untitled: string
  readonly empty: string
  readonly loading: string
}

type ExplorerCallbacks = {
  readonly onClose: () => void
  readonly onSelect: (path: string) => void
  readonly onToggle: (path: string) => void
  readonly onCreate: (type: 'file' | 'directory', parentPath: string | null) => void
  readonly onDelete: (path: string) => void
  readonly onCommitDraft: (name: string) => void
  readonly onCancelDraft: () => void
  readonly onStartRename: (path: string) => void
  readonly onCommitRename: (name: string) => void
  readonly onCancelRename: () => void
}

// Everything the recursive row components need: the callbacks plus the resolved labels, the selected
// path, and the active draft.
type RowContext = ExplorerCallbacks & {
  readonly labels: ExplorerLabels
  readonly selected: string | null
  readonly draft: DraftNode | null
  readonly renamingPath: string | null
}

export type { TreeNodeModel, DraftNode, ExplorerLabels, ExplorerCallbacks, RowContext }
