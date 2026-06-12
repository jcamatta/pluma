// The slash menu popup: a floating panel of block-type rows, fixed at the caret coordinates the bridge
// reports. Pure view — every value (already-translated labels, the highlighted index, the caret position,
// the callbacks) arrives through props; it holds no hooks and owns no state. Keyboard lives in the editor
// plugin, so the rows are presentation that report hover/click outward; the highlight is driven by
// `activeIndex`. Motion animates the panel's mount/exit and each row's press.

import { Button } from '@base-ui/react'
import { motion } from 'motion/react'
import { SlashCommandIcon } from './slash-command-icon'
import type { SlashCommandId } from './slash-command-catalog'
import { cn } from '../../components/cn'

type SlashMenuItem = {
  readonly id: SlashCommandId
  readonly label: string
  readonly hint: string
}

type SlashMenuViewProps = {
  readonly items: readonly SlashMenuItem[]
  readonly activeIndex: number
  readonly position: { readonly x: number; readonly y: number }
  readonly heading: string
  readonly emptyLabel: string
  readonly onSelect: (index: number) => void
  readonly onHover: (index: number) => void
}

function SlashMenuView({
  items,
  activeIndex,
  position,
  heading,
  emptyLabel,
  onSelect,
  onHover
}: SlashMenuViewProps): React.JSX.Element {
  return (
    <motion.div
      role="listbox"
      aria-label={heading}
      className="fixed z-50 w-72 overflow-hidden rounded-lg border border-(--line2) bg-surface-2 shadow-lg"
      style={{ left: position.x, top: position.y }}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
    >
      <div className="px-3 py-2 text-xs font-medium text-text-muted">{heading}</div>
      <div className="max-h-80 overflow-y-auto px-1 pb-1">
        {items.length === 0 ? (
          <div className="px-3 py-2 text-sm text-text-muted">{emptyLabel}</div>
        ) : (
          items.map((item, index) => (
            <Button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => onHover(index)}
              onClick={() => onSelect(index)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
                index === activeIndex ? 'bg-(--hover)' : ''
              )}
              render={
                <motion.button whileTap={{ scale: 0.98 }}>
                  <SlashCommandIcon id={item.id} />
                  <span className="text-sm text-text-primary">{item.label}</span>
                  {item.hint ? (
                    <span className="ml-auto text-xs text-text-muted">{item.hint}</span>
                  ) : null}
                </motion.button>
              }
            />
          ))
        )}
      </div>
    </motion.div>
  )
}

export { SlashMenuView }
export type { SlashMenuItem, SlashMenuViewProps }
