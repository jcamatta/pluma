// Owns the threads panel's per-row command state: which row is being renamed inline and which row has a
// pending delete confirmation, plus the handlers that drive the rename/delete command hooks. A blank
// rename is ignored (the backend would otherwise clear the title). Deleting the active thread invokes
// onActiveDeleted so the caller can start a fresh thread. Keeps this logic out of the panel controller.

import { useState } from 'react'
import { useRenameThread } from './useRenameThread'
import { useDeleteThread } from './useDeleteThread'

interface ThreadCommandsArgs {
  readonly cwd: string
  readonly activeId: string | null
  readonly onActiveDeleted: () => void
}

interface ThreadCommands {
  readonly editingId: string | null
  readonly deletePendingId: string | null
  readonly startRename: (id: string) => void
  readonly commitRename: (id: string, title: string) => void
  readonly cancelRename: () => void
  readonly requestDelete: (id: string) => void
  readonly confirmDelete: () => void
  readonly cancelDelete: () => void
}

function useThreadCommands({ cwd, activeId, onActiveDeleted }: ThreadCommandsArgs): ThreadCommands {
  const { rename } = useRenameThread()
  const { remove } = useDeleteThread()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null)

  const commitRename = (id: string, title: string): void => {
    setEditingId(null)
    if (title.length > 0) void rename({ cwd, id, title })
  }

  const confirmDelete = (): void => {
    const id = deletePendingId
    setDeletePendingId(null)
    if (id === null) return
    void remove({ cwd, id })
    if (id === activeId) onActiveDeleted()
  }

  return {
    editingId,
    deletePendingId,
    startRename: (id) => setEditingId(id),
    commitRename,
    cancelRename: () => setEditingId(null),
    requestDelete: (id) => setDeletePendingId(id),
    confirmDelete,
    cancelDelete: () => setDeletePendingId(null)
  }
}

export { useThreadCommands }
export type { ThreadCommands, ThreadCommandsArgs }
