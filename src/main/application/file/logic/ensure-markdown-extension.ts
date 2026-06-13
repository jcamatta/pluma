// Defaults a created file's path to the .md extension: appends .md when the (trimmed) path lacks it
// (case-insensitive), so a user can create "notes" and get "notes.md". An empty path is left empty for
// validateMarkdownPath to reject. Markdown-only is a domain rule, so it lives here rather than in the UI.

function ensureMarkdownExtension(path: string): string {
  const trimmed = path.trim()
  if (trimmed.length === 0) return trimmed
  return trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`
}

export { ensureMarkdownExtension }
