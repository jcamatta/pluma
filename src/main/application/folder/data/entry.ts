// Business type: one immediate child of a listed folder. `name` is the entry's basename (not a full
// path); `type` distinguishes a regular file from a directory so the explorer can render and expand it.

export interface FolderEntry {
  readonly name: string
  readonly type: 'file' | 'directory'
}
