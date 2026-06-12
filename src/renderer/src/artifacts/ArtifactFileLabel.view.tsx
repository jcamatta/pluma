// The small muted chip on every artifact card naming the file it belongs to — the panel aggregates
// artifacts from every open file, so each card states its own. Shows the path's basename (the same name
// the editor top bar uses, `.md` stripped), falling back to the raw path. Pure props, hook-free.

import { editorFileName } from '../editor/editor-file-name-logic'

function ArtifactFileLabel({ path }: { readonly path: string }): React.JSX.Element {
  return (
    <span className="truncate text-xs text-text-muted" title={path}>
      {editorFileName(path, path)}
    </span>
  )
}

export { ArtifactFileLabel }
