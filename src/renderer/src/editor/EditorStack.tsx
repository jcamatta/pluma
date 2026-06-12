// Mounts one editor per open file and shows the active one; the others stay mounted but hidden so
// their artifacts (annotations/proposals) survive switching away and back. Each EditorController loads
// its own file and registers itself as the active editor only while active. With no file open yet it
// mounts a single empty editor so the surface is never blank.

import { EditorController } from './Editor.controller'
import type { OpenFiles } from './open-files-logic'

interface EditorStackProps {
  readonly open: OpenFiles
  readonly onOpenSettings: () => void
}

function EditorStack({ open, onOpenSettings }: EditorStackProps): React.JSX.Element {
  if (open.active === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EditorController path={null} isActive onOpenSettings={onOpenSettings} />
      </div>
    )
  }

  return (
    <>
      {open.paths.map((path) => (
        <div
          key={path}
          className={path === open.active ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        >
          <EditorController
            path={path}
            isActive={path === open.active}
            onOpenSettings={onOpenSettings}
          />
        </div>
      ))}
    </>
  )
}

export { EditorStack }
export type { EditorStackProps }
