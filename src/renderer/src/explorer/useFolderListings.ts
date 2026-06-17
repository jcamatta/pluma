// Query hook for many folder listings at once. Given the paths to list (root + every open folder), it
// runs one ['folder', path] query per path via useQueries and returns a lookup from a path to its
// entries (undefined while loading or on ok: false) plus isLoading, true only while a path's listing is
// loading for the first time (no cached data) — a background refetch keeps the prior data and isn't
// pending, so the explorer's skeleton shows on first open but not on a watcher re-list. The reader port
// is the seam — no window.api. This is the read side the tree builds from; commands live in the
// create/delete hooks.

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useRepos } from './RepositoriesContext'
import { folderListingKey } from './folder-query-keys'
import type { ListingLookup } from './explorer-tree-build'

type FolderListings = {
  readonly lookup: ListingLookup
  readonly isLoading: (path: string) => boolean
}

function useFolderListings(paths: readonly string[]): FolderListings {
  const { reader } = useRepos()
  const results = useQueries({
    queries: paths.map((path) => ({
      queryKey: folderListingKey(path),
      queryFn: () => reader.list(path)
    }))
  })

  return useMemo(() => {
    const entries = new Map(
      paths.map((path, index) => {
        const data = results[index]?.data
        return [path, data && data.ok ? data.value : undefined]
      })
    )
    const pending = new Map(paths.map((path, index) => [path, results[index]?.isPending ?? true]))
    return {
      lookup: (path: string) => entries.get(path),
      isLoading: (path: string) => pending.get(path) ?? false
    }
  }, [paths, results])
}

export { useFolderListings }
