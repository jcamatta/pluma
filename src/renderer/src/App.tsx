// Root application component and app shell. Owns the cross-cutting layout state the design's App holds
// for the shipped (conversation) layout: the picked root folder, the selected file, and which side
// panels are open. Composes the three columns — Explorer | editor | (rail, later) — matching
// .references/pluma-design, rendered in our tokens.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorController } from './editor/Editor.controller'
import { ActiveEditorProvider } from './editor/ActiveEditorProvider'
import { EditorToolsBridge } from './editor/EditorToolsBridge'
import { ExplorerController } from './explorer/Explorer.controller'
import { useFileContent } from './explorer/useFileContent'
import { LauncherController } from './launcher/Launcher.controller'
import { MessagesSquare, PanelLeft } from 'lucide-react'
import { EdgeTab } from './components/EdgeTab'
import { AgentProvider } from './agent/AgentProvider'
import { AgentToolsProvider } from './agent/AgentToolsProvider'
import { ConversationRailController } from './rail/ConversationRail.controller'
import { SettingsDialog } from './settings/SettingsDialog'
import { useSettings } from './settings/useSettings'

export const App = (): React.JSX.Element => {
  const { t } = useTranslation()
  const [root, setRoot] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [railOpen, setRailOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settings = useSettings()
  const fileContent = useFileContent(selected)
  const content = fileContent && fileContent.ok ? fileContent.value : null

  if (root === null) {
    return <LauncherController onPicked={setRoot} />
  }

  return (
    <AgentToolsProvider>
      <AgentProvider cwd={root}>
        <ActiveEditorProvider>
          <EditorToolsBridge />
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
              <EditorController
                path={selected}
                content={content}
                onOpenSettings={() => setSettingsOpen(true)}
              />
              {!explorerOpen && (
                <EdgeTab
                  side="left"
                  label={t('explorer.open')}
                  icon={<PanelLeft size={17} />}
                  onOpen={() => setExplorerOpen(true)}
                />
              )}
              {!railOpen && (
                <EdgeTab
                  side="right"
                  label={t('rail.open')}
                  icon={<MessagesSquare size={17} />}
                  onOpen={() => setRailOpen(true)}
                />
              )}
            </div>

            {railOpen && (
              <div className="flex-none" style={{ width: 'var(--rail-w)' }}>
                <ConversationRailController cwd={root} onClose={() => setRailOpen(false)} />
              </div>
            )}

            <SettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              settings={settings}
            />
          </main>
        </ActiveEditorProvider>
      </AgentProvider>
    </AgentToolsProvider>
  )
}
