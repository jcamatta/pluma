// Mounts one editor per open file and shows the active one; the others stay mounted but hidden so their
// artifacts (annotations/proposals) survive switching away and back. The whole stack lives inside a Base
// UI Tabs.Root controlled by the active path, so the tab strip drives switching: clicking a tab calls
// onActivate. Each EditorController loads its own file and registers itself as the active editor only
// while active. With no file open it shows the empty state instead of a writable editor — there is no
// path to autosave to, so a phantom editor would only invite typing that is then discarded.

import { useTranslation } from 'react-i18next'
import { Tabs } from '@base-ui/react/tabs'
import { EditorController } from './Editor.controller'
import { EditorEmptyStateView } from './EditorEmptyState.view'
import { EditorTabStrip } from './EditorTabStrip.view'
import { buildEditorTabs } from './editor-tabs-logic'
import { useOpenFiles } from './OpenFilesContext'
import type { OpenFiles } from './open-files-logic'

interface EditorStackProps {
  readonly open: OpenFiles
  readonly onOpenSettings: () => void
}

function EditorStack({ open, onOpenSettings }: EditorStackProps): React.JSX.Element {
  const { t } = useTranslation()
  const { open: activate, close } = useOpenFiles()

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
    <Tabs.Root
      value={open.active}
      onValueChange={(value: unknown) => {
        if (typeof value === 'string') activate(value)
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <EditorTabStrip
        tabs={buildEditorTabs(open, t('editor.untitled'))}
        settingsLabel={t('editor.settings')}
        closeLabel={(name) => t('editor.tabs.close', { name })}
        onClose={close}
        onOpenSettings={onOpenSettings}
      />
      {open.paths.map((path) => (
        <div
          key={path}
          className={path === open.active ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        >
          <EditorController path={path} isActive={path === open.active} />
        </div>
      ))}
    </Tabs.Root>
  )
}

export { EditorStack }
export type { EditorStackProps }
