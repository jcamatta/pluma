// Headless bridge that runs the close-on-delete watcher inside the providers. Renders nothing; it only
// mounts useCloseDeletedFiles so a deleted file leaves the open set wherever it is in the tree.

import { useCloseDeletedFiles } from './useCloseDeletedFiles'

function DeletedFilesBridge(): null {
  useCloseDeletedFiles()
  return null
}

export { DeletedFilesBridge }
