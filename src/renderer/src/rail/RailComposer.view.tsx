// The rail's pinned composer: a textarea in a styled card with the run-control selectors (model /
// effort) on the left of a bottom toolbar and an animated Send button on the right. Pure props. The Send
// button uses the accent (action-primary) so it reads against the card, and animates on hover/tap via
// Motion through Base UI's render prop; it is dimmed and inert until the composer holds non-whitespace
// text. While a run is in flight the action slot swaps to a Stop button — interrupting belongs with the
// run's controls here, not stacked under the assistant's message.

import { ArrowUp, Square } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@base-ui/react'
import { motion } from 'motion/react'
import { ComposerField } from './ComposerField'
import { RunControlSelect, type RunControlSelectProps } from './RunControlSelect.view'

interface RailComposerProps {
  readonly placeholder: string
  readonly send: string
  readonly stop: string
  readonly working: boolean
  readonly value: string
  readonly model: RunControlSelectProps
  readonly effort: RunControlSelectProps
  // The context meter, built by the controller; sits with the send/stop action on the right of the
  // toolbar. Absent until a run (or a resumed thread) has produced a usage figure.
  readonly contextSlot?: ReactNode
  readonly onChange: (value: string) => void
  readonly onSubmit: () => void
  readonly onStop: () => void
}

export function RailComposer({
  placeholder,
  send,
  stop,
  working,
  value,
  model,
  effort,
  contextSlot,
  onChange,
  onSubmit,
  onStop
}: RailComposerProps): React.JSX.Element {
  const canSend = value.trim().length > 0

  return (
    <div className="flex-none border-t border-(--line) px-4 pb-4 pt-3">
      <div className="overflow-hidden rounded-2xl border border-(--line2) bg-surface-1">
        <ComposerField
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !working) {
              event.preventDefault()
              onSubmit()
            }
          }}
        />
        <div className="flex items-center gap-2 px-3 pb-2 pt-1">
          <RunControlSelect {...model} />
          <RunControlSelect {...effort} />
          <div className="ml-auto flex items-center gap-1">
            {contextSlot}
            {working ? (
              <Button
                type="button"
                onClick={onStop}
                aria-label={stop}
                className="flex size-8 items-center justify-center rounded-xl border border-(--line2) text-text-secondary"
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
                className="flex size-8 items-center justify-center rounded-xl bg-action-primary text-text-on-accent disabled:bg-(--line2) disabled:text-text-muted"
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
    </div>
  )
}

export type { RailComposerProps }
