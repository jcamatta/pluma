// Mounts useInitialFileSelection inside the OpenFilesContext provider so the hook can reach the open-files
// nav. Renders nothing; it exists only to own that wiring, the way EditorToolsBridge owns the editor-tool
// registration — keeping the App shell free of the hook's provider dependency.

import { useInitialFileSelection } from './useInitialFileSelection'

function InitialFileBridge({ root }: { readonly root: string | null }): null {
  useInitialFileSelection(root)
  return null
}

export { InitialFileBridge }
