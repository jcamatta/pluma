// The editor panel's tab strip: one Base UI tab per open file. Pure layout — it is composed inside the
// Tabs.Root that EditorStack owns, so it neither holds the active value nor calls onValueChange; selection
// arrives as data-active on each Tab. The active tab is marked by an accent bottom border on the Tab
// itself rather than a floating Tabs.Indicator: the indicator is positioned from measured pixel offsets
// that go stale on a relayout which does not change the selection (closing the explorer widens the panel),
// leaving the underline stranded; a border in normal flow always tracks its tab. Each tab carries a close
// button rendered as a sibling overlaying its right edge (a button cannot nest inside the Tab's button)
// and closes on a middle-click anywhere on it (the browser-tab convention). The strip scrolls horizontally
// when the tabs outgrow the panel width. The settings gear sits outside the scroll region at the right edge.

import { Tabs } from '@base-ui/react/tabs'
import { AnimatePresence, motion } from 'motion/react'
import { FileText, Settings, X } from 'lucide-react'
import { IconButton } from '../components/IconButton'
import { Scrollable } from '../components/Scrollable'
import type { EditorTab } from './editor-tabs-logic'

type EditorTabStripProps = {
  readonly tabs: readonly EditorTab[]
  readonly settingsLabel: string
  readonly closeLabel: (name: string) => string
  readonly badgeLabel: (count: number) => string
  readonly onClose: (path: string) => void
  readonly onOpenSettings: () => void
}

export function EditorTabStrip({
  tabs,
  settingsLabel,
  closeLabel,
  badgeLabel,
  onClose,
  onOpenSettings
}: EditorTabStripProps): React.JSX.Element {
  return (
    <div className="flex h-12 flex-none items-stretch border-b border-(--line)">
      <Scrollable orientation="horizontal" className="h-full flex-1" contentClassName="h-full">
        <Tabs.List className="flex h-full items-stretch">
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <motion.div
                key={tab.path}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onAuxClick={(event) => {
                  if (event.button === 1) onClose(tab.path)
                }}
                className="relative flex items-stretch"
              >
                <Tabs.Tab
                  value={tab.path}
                  render={<motion.button whileTap={{ scale: 0.97 }} />}
                  className="group flex h-full items-center gap-2 whitespace-nowrap border-b-2 border-transparent pr-9 pl-4 text-sm font-semibold text-text-muted outline-none data-[active]:border-action-primary data-[active]:text-text-primary"
                >
                  <FileText
                    size={15}
                    className="text-text-muted group-data-[active]:text-action-primary"
                  />
                  {tab.name}
                  {tab.pendingCount > 0 && (
                    <span
                      aria-label={badgeLabel(tab.pendingCount)}
                      className="rounded-full bg-action-primary px-2 text-xs font-semibold text-text-on-accent"
                    >
                      {tab.pendingCount}
                    </span>
                  )}
                </Tabs.Tab>
                <IconButton
                  label={closeLabel(tab.name)}
                  onClick={() => onClose(tab.path)}
                  stopPropagation
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1"
                >
                  <X size={14} />
                </IconButton>
              </motion.div>
            ))}
          </AnimatePresence>
        </Tabs.List>
      </Scrollable>
      <div className="flex flex-none items-center pr-3">
        <IconButton label={settingsLabel} onClick={onOpenSettings} className="rounded-lg p-2">
          <Settings size={17} />
        </IconButton>
      </div>
    </div>
  )
}
