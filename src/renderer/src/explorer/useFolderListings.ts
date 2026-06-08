// Query hook for many folder listings at once. Given the paths to list (root + every open folder), it
// runs one ['folder', path] query per path via useQueries and returns a lookup from a path to its
// entries (undefined while loading or on ok: false). The reader port is the seam — no window.api. This
// is the read side the tree builds from; commands live in the create/delete hooks.

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useRepos } from './RepositoriesContext'
import { folderListingKey } from './folder-query-keys'
import type { ListingLookup } from './explorer-tree-build'

function useFolderListings(paths: readonly string[]): ListingLookup {
  const { reader } = useRepos()
  const results = useQueries({
    queries: paths.map((path) => ({
      queryKey: folderListingKey(path),
      queryFn: () => reader.list(path)
    }))
  })

  return useMemo(() => {
    const byPath = new Map(
      paths.map((path, index) => {
        const data = results[index]?.data
        return [path, data && data.ok ? data.value : undefined]
      })
    )
    return (path: string) => byPath.get(path)
  }, [paths, results])
}

export { useFolderListings }
