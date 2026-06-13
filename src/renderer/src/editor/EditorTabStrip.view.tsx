// The editor panel's tab strip: one Base UI tab per open file, the active one tracked by Tabs.Indicator
// (the sliding accent underline). Pure layout — it is composed inside the Tabs.Root that EditorStack
// owns, so it neither holds the active value nor calls onValueChange; selection arrives as data-selected
// on each Tab. Each tab carries a close button rendered as a sibling overlaying its right edge (a button
// cannot nest inside the Tab's button), and the strip scrolls horizontally when the tabs outgrow the
// panel width. The settings gear sits outside the scroll region at the right edge.

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
  readonly onClose: (path: string) => void
  readonly onOpenSettings: () => void
}

export function EditorTabStrip({
  tabs,
  settingsLabel,
  closeLabel,
  onClose,
  onOpenSettings
}: EditorTabStripProps): React.JSX.Element {
  return (
    <div className="flex h-12 flex-none items-stretch border-b border-(--line)">
      <Scrollable orientation="horizontal" className="h-full flex-1" contentClassName="h-full">
        <Tabs.List className="relative flex h-full items-stretch">
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <motion.div
                key={tab.path}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative flex items-stretch"
              >
                <Tabs.Tab
                  value={tab.path}
                  render={<motion.button whileTap={{ scale: 0.97 }} />}
                  className="group flex h-full items-center gap-2 whitespace-nowrap pr-9 pl-4 text-sm font-semibold text-text-muted outline-none data-[selected]:text-text-primary"
                >
                  <FileText
                    size={15}
                    className="text-text-muted group-data-[selected]:text-action-primary"
                  />
                  {tab.name}
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
          <Tabs.Indicator
            className="absolute bottom-0 rounded-sm bg-action-primary"
            style={{
              left: 'var(--active-tab-left)',
              width: 'var(--active-tab-width)',
              height: 2,
              transition: 'left 150ms ease, width 150ms ease'
            }}
          />
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
