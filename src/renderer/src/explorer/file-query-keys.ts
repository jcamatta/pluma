// The React Query key for a file's content. One pure helper so the read hook keys a file's content by
// ['file', path], matching the folder listing key shape.

function fileContentKey(path: string): readonly [string, string] {
  return ['file', path]
}

export { fileContentKey }
