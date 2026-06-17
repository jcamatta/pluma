// Root application component and app shell. Owns the cross-cutting layout state the design's App holds
// for the shipped (conversation) layout: the picked root folder, the selected file, and which side
// panels are open. Composes the three columns — Explorer | editor | (rail, later) — matching
// .references/pluma-design, rendered in our tokens.

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorStack } from './editor/EditorStack'
import { noOpenFiles, openFile, closeFile } from './editor/open-files-logic'
import { ActiveEditorProvider } from './editor/ActiveEditorProvider'
import { OpenFilesContext } from './editor/OpenFilesContext'
import type { OpenFilesNav } from './editor/OpenFilesContext'
import { EditorToolsBridge } from './editor/EditorToolsBridge'
import { InitialFileBridge } from './editor/InitialFileBridge'
import { DeletedFilesBridge } from './editor/DeletedFilesBridge'
import { ExplorerController } from './explorer/Explorer.controller'
import { LauncherController } from './launcher/Launcher.controller'
import { MessagesSquare, PanelLeft } from 'lucide-react'
import { EdgeTab } from './components/EdgeTab'
import { AgentProviders } from './agent/AgentProviders'
import { ConversationRailController } from './rail/ConversationRail.controller'
import { ChatShortcutBridge } from './rail/ChatShortcutBridge'
import { ComposerFocusProvider } from './rail/ComposerFocusProvider'
import { SettingsDialog } from './settings/SettingsDialog'
import { useSettings } from './settings/useSettings'

export const App = (): React.JSX.Element => {
  const { t } = useTranslation()
  const [root, setRoot] = useState<string | null>(null)
  const [open, setOpen] = useState(noOpenFiles)
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [railOpen, setRailOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settings = useSettings()
  const openRail = useCallback(() => setRailOpen(true), [])
  const openFiles = useMemo<OpenFilesNav>(
    () => ({
      activePath: open.active,
      open: (path) => setOpen((current) => openFile(current, path)),
      close: (path) => setOpen((current) => closeFile(current, path))
    }),
    [open.active]
  )

  if (root === null) return <LauncherController onPicked={setRoot} />

  return (
    <AgentProviders cwd={root}>
      <ActiveEditorProvider>
        <ComposerFocusProvider>
          <OpenFilesContext.Provider value={openFiles}>
            <EditorToolsBridge />
            <ChatShortcutBridge openRail={openRail} />
            <InitialFileBridge root={root} />
            <DeletedFilesBridge />
            <main className="flex h-screen gap-3 bg-surface-1 p-4 font-ui text-text-primary">
              {explorerOpen && (
                <div className="flex-none" style={{ width: 'var(--explorer-w)' }}>
                  <ExplorerController
                    root={root}
                    selected={open.active}
                    onSelect={(path) => setOpen((current) => openFile(current, path))}
                    onClose={() => setExplorerOpen(false)}
                  />
                </div>
              )}

              <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface-3">
                <EditorStack open={open} onOpenSettings={() => setSettingsOpen(true)} />
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
          </OpenFilesContext.Provider>
        </ComposerFocusProvider>
      </ActiveEditorProvider>
    </AgentProviders>
  )
}
