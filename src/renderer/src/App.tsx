// Root application component and app shell. Owns the cross-cutting layout state the design's App holds
// for the shipped (conversation) layout: the picked root folder, the selected file, and which side
// panels are open. Composes the three columns — Explorer | editor | (rail, later) — matching
// .references/pluma-design, rendered in our tokens.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorController } from './editor/Editor.controller'
import { ExplorerController } from './explorer/Explorer.controller'
import { useRootFolder } from './explorer/useRootFolder'
import { Button } from '@base-ui/react'
import { Folder, PanelLeft } from 'lucide-react'
import { EdgeTab } from './components/EdgeTab'

export const App = (): React.JSX.Element => {
  const { t } = useTranslation()
  const { root, pick } = useRootFolder()
  const [selected, setSelected] = useState<string | null>(null)
  const [explorerOpen, setExplorerOpen] = useState(true)

  if (root === null) {
    return (
      <main className="flex h-screen items-center justify-center bg-surface-1 font-ui text-text-primary">
        <Button
          type="button"
          onClick={() => void pick()}
          className="flex items-center gap-2 rounded-full bg-action-primary px-4 py-2 text-sm font-semibold text-text-on-accent"
        >
          <span className="flex text-on-accent">
            <Folder size={16} />
          </span>
          {t('explorer.pickFolder')}
        </Button>
      </main>
    )
  }

  return (
    <main className="flex h-screen gap-3 bg-surface-1 p-4 font-ui text-text-primary">
      {explorerOpen && (
        <div className="flex-none" style={{ width: 'var(--explorer-w)' }}>
          <ExplorerController
            root={root}
            selected={selected}
            onSelect={setSelected}
            onClose={() => setExplorerOpen(false)}
          />
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface-3">
        <EditorController />
        {!explorerOpen && (
          <EdgeTab
            side="left"
            label={t('explorer.open')}
            icon={<PanelLeft size={17} />}
            onOpen={() => setExplorerOpen(true)}
          />
        )}
      </div>
    </main>
  )
}
