// Normalizes a typed file name so it always carries a .md extension: returns the name unchanged when
// it already ends in .md (case-insensitive), otherwise appends .md. Folders never go through this.

function ensureMarkdownExtension(name: string): string {
  return name.toLowerCase().endsWith('.md') ? name : `${name}.md`
}

export { ensureMarkdownExtension }
