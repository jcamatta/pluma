// Typed failure: the user dismissed the folder-picker dialog without choosing a folder. Not a real
// error, but the IPC boundary serializes every non-success outcome as a tagged error; the renderer
// translates this into a no-op rather than a message.

import * as Data from 'effect/Data'

export class FolderSelectionCancelled extends Data.TaggedError('FolderSelectionCancelled')<
  Record<string, never>
> {}
