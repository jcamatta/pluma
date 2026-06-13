// Wires the explorer to the real filesystem: useExplorerTree owns the lazily-loaded tree and the
// folder/file IPC operations, and this controller resolves the i18n labels and renders the pure
// ExplorerView. File selection is lifted to the shell via props so the editor can read it.

import { useTranslation } from 'react-i18next'
import { ExplorerView } from './Explorer.view'
import { useExplorerTree } from './useExplorerTree'

type ExplorerControllerProps = {
  readonly root: string
  readonly selected: string | null
  readonly onSelect: (path: string) => void
  readonly onClose: () => void
}

export function ExplorerController({
  root,
  selected,
  onSelect,
  onClose
}: ExplorerControllerProps): React.JSX.Element {
  const { t } = useTranslation()
  const {
    tree,
    draft,
    renamingPath,
    toggle,
    beginCreate,
    commitDraft,
    cancelDraft,
    remove,
    beginRename,
    commitRename,
    cancelRename
  } = useExplorerTree(root, { selected, onSelect })

  return (
    <ExplorerView
      labels={{
        title: t('explorer.title'),
        newFile: t('explorer.newFile'),
        newFolder: t('explorer.newFolder'),
        deleteFile: t('explorer.deleteFile'),
        deleteFolder: t('explorer.deleteFolder'),
        renameFolder: t('explorer.renameFolder'),
        collapse: t('explorer.collapse'),
        untitled: t('explorer.untitled'),
        empty: t('explorer.empty')
      }}
      tree={tree}
      selected={selected}
      draft={draft}
      renamingPath={renamingPath}
      onClose={onClose}
      onSelect={onSelect}
      onToggle={toggle}
      onCreate={beginCreate}
      onDelete={remove}
      onCommitDraft={commitDraft}
      onCancelDraft={cancelDraft}
      onStartRename={beginRename}
      onCommitRename={commitRename}
      onCancelRename={cancelRename}
    />
  )
}
