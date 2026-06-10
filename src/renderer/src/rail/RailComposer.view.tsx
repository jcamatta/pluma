// The rail's pinned composer: a textarea in a styled card with the ⌘↵ hint and an animated Send
// button. Pure props. The Send button uses the accent (action-primary) so it reads against the card,
// and animates on hover/tap via Motion through Base UI's render prop; it is dimmed and inert until the
// composer holds non-whitespace text. While a run is in flight the action slot swaps to a Stop button —
// interrupting belongs with the run's controls here, not stacked under the assistant's message.

import { ArrowUp, Square } from 'lucide-react'
import { Button } from '@base-ui/react'
import { motion } from 'motion/react'

interface RailComposerProps {
  readonly placeholder: string
  readonly toSend: string
  readonly send: string
  readonly stop: string
  readonly working: boolean
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onSubmit: () => void
  readonly onStop: () => void
}

export function RailComposer({
  placeholder,
  toSend,
  send,
  stop,
  working,
  value,
  onChange,
  onSubmit,
  onStop
}: RailComposerProps): React.JSX.Element {
  const canSend = value.trim().length > 0

  return (
    <div className="flex-none border-t border-(--line) px-4 pb-4 pt-3">
      <div className="overflow-hidden rounded-2xl border border-(--line2) bg-surface-1">
        <textarea
          data-rail-composer
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !working) {
              event.preventDefault()
              onSubmit()
            }
          }}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none bg-transparent px-4 pb-1 pt-3 font-ui text-sm leading-normal text-text-primary outline-none"
        />
        <div className="flex items-center gap-2 px-3 pb-2 pt-1">
          <span className="flex items-center gap-2 text-xs text-text-muted">
            <kbd className="rounded-md border border-(--line2) bg-surface-3 px-2 py-1 font-ui text-xs">
              ⌘ ↵
            </kbd>
            {toSend}
          </span>
          {working ? (
            <Button
              type="button"
              onClick={onStop}
              aria-label={stop}
              className="ml-auto flex size-8 items-center justify-center rounded-xl border border-(--line2) text-text-secondary"
              render={
                <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
                  <Square size={13} />
                </motion.button>
              }
            />
          ) : (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!canSend}
              aria-label={send}
              className="ml-auto flex size-8 items-center justify-center rounded-xl bg-action-primary text-text-on-accent disabled:bg-(--line2) disabled:text-text-muted"
              render={
                <motion.button
                  whileHover={canSend ? { scale: 1.08 } : undefined}
                  whileTap={canSend ? { scale: 0.92 } : undefined}
                >
                  <ArrowUp size={17} />
                </motion.button>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}

export type { RailComposerProps }
