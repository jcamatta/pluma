// The React Query keys for the explorer's folder listings. One pure helper so the query hook, the
// command hooks (invalidation), and the watcher all agree on the same key shape: a folder's listing is
// keyed by ['folder', path].

function folderListingKey(path: string): readonly [string, string] {
  return ['folder', path]
}

export { folderListingKey }
