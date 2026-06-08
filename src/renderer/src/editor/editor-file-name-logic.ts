// Derives the label the editor top bar shows for the open file: the path's basename with a trailing
// `.md` extension stripped (the design shows "Act I", not "Act I.md"). Pure string work, unit-tested in
// isolation. Returns the fallback when no file is open or the path has no usable basename.

function editorFileName(path: string | null, fallback: string): string {
  if (path === null) return fallback
  const lastSlash = path.lastIndexOf('/')
  const lastBackslash = path.lastIndexOf('\\')
  const cut = Math.max(lastSlash, lastBackslash)
  const base = path.slice(cut + 1)
  const name = base.replace(/\.md$/, '')
  return name.length > 0 ? name : fallback
}

export { editorFileName }
