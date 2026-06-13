// When a workspace is opened, lands the user in the first markdown file at its root. Reads the root
// listing through the same query the explorer uses (React Query dedupes the key, so no extra IPC), and
// once it resolves opens the first markdown file via the open-files nav. A ref guards it to one firing
// per root: it runs only on the first resolved listing for a given root, so reopening a file the user
// closed — or a root with no markdown file (the empty state then shows) — never re-triggers it.

import { useEffect, useRef } from 'react'
import { useFolderListings } from '../explorer/useFolderListings'
import { joinPath } from '../explorer/explorer-tree'
import { useOpenFiles } from './OpenFilesContext'
import { firstMarkdownFile } from './first-markdown-file'

function useInitialFileSelection(root: string | null): void {
  const { open } = useOpenFiles()
  const listing = useFolderListings(root === null ? [] : [root])
  const entries = root === null ? undefined : listing(root)
  const initializedRoot = useRef<string | null>(null)

  useEffect(() => {
    if (root === null || entries === undefined) return
    if (initializedRoot.current === root) return
    initializedRoot.current = root
    const name = firstMarkdownFile(entries)
    if (name !== null) open(joinPath(root, name))
  }, [root, entries, open])
}

export { useInitialFileSelection }
