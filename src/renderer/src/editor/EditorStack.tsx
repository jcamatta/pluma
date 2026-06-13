// Mounts one editor per open file and shows the active one; the others stay mounted but hidden so
// their artifacts (annotations/proposals) survive switching away and back. Each EditorController loads
// its own file and registers itself as the active editor only while active. With no file open it shows
// the empty state instead of a writable editor — there is no path to autosave to, so a phantom editor
// would only invite typing that is then discarded.

import { useTranslation } from 'react-i18next'
import { EditorController } from './Editor.controller'
import { EditorEmptyStateView } from './EditorEmptyState.view'
import type { OpenFiles } from './open-files-logic'

interface EditorStackProps {
  readonly open: OpenFiles
  readonly onOpenSettings: () => void
}

function EditorStack({ open, onOpenSettings }: EditorStackProps): React.JSX.Element {
  const { t } = useTranslation()

  if (open.active === null) {
    return (
      <EditorEmptyStateView
        heading={t('editor.empty.heading')}
        hint={t('editor.empty.hint')}
        settingsLabel={t('editor.settings')}
        onOpenSettings={onOpenSettings}
      />
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
