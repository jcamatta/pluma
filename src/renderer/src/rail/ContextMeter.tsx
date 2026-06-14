// The composer's context meter: a small ring showing how full the model's context window is for the
// current thread. Hovering it shows the exact figure (Tooltip); clicking it opens a breakdown of the
// input vs cached tokens (Popover). A plain visual component — it owns only the popover's open state and
// receives the usage and translated labels as props, computing the ring fill and compact token labels
// from the pure context-meter calculations. Rendered in our design tokens; the trigger animates with
// Motion, the portal popups fade in via Base UI's data-starting/ending-style transitions.

import { useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Tooltip } from '@base-ui/react/tooltip'
import { motion } from 'motion/react'
import type { AgentContextUsage } from '../../../shared/agent/context-usage'
import { contextPercent, contextRatio, formatTokenCount } from './context-meter-logic'

interface ContextMeterLabels {
  // The hovered/SR summary, e.g. "Context". The figure and percent are appended from the usage.
  readonly context: string
  readonly title: string
  readonly input: string
  readonly cacheRead: string
  readonly cacheWrite: string
}

interface ContextMeterProps {
  readonly usage: AgentContextUsage
  readonly labels: ContextMeterLabels
}

// The ring is a conic-gradient donut rather than a drawn SVG (hand-rolled SVG is lint-banned): an arc of
// the accent colour up to the fill angle over a muted track, with a surface-coloured hole punched in the
// middle. It turns warning-coloured as the window nears full. Scales in with Motion on mount.
function Ring({ ratio }: { readonly ratio: number }): React.JSX.Element {
  const arc = ratio >= 0.9 ? 'var(--color-feedback-warning)' : 'var(--color-action-primary)'
  return (
    <motion.span
      className="flex size-5 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${arc} ${ratio * 360}deg, var(--line2) 0deg)` }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <span data-testid="context-ring" className="size-3 rounded-full bg-surface-1" />
    </motion.span>
  )
}

function Row({
  label,
  value
}: {
  readonly label: string
  readonly value: string
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-text-secondary">{label}</span>
      <span className="font-mono text-text-primary">{value}</span>
    </div>
  )
}

export function ContextMeter({ usage, labels }: ContextMeterProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ratio = contextRatio(usage.usedTokens, usage.windowTokens)
  const figure = `${formatTokenCount(usage.usedTokens)} / ${formatTokenCount(usage.windowTokens)} (${contextPercent(ratio)}%)`
  const summary = `${labels.context} ${figure}`

  return (
    <Tooltip.Provider delay={200}>
      <Tooltip.Root>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Tooltip.Trigger
            render={
              <Popover.Trigger
                aria-label={summary}
                data-testid="context-meter"
                className="ml-auto flex items-center justify-center rounded-lg p-1 text-text-secondary hover:bg-(--hover)"
                render={<motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }} />}
              >
                <Ring ratio={ratio} />
              </Popover.Trigger>
            }
          />
          <Popover.Portal>
            <Popover.Positioner side="top" align="end" sideOffset={8}>
              <Popover.Popup className="flex w-56 flex-col gap-2 rounded-xl border border-border bg-surface-1 p-3 text-sm shadow-lg transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                <div className="flex items-baseline justify-between gap-4">
                  <Popover.Title className="font-semibold text-text-primary">
                    {labels.title}
                  </Popover.Title>
                  <span className="font-mono text-text-secondary">{figure}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <Row label={labels.input} value={formatTokenCount(usage.breakdown.inputTokens)} />
                  <Row
                    label={labels.cacheRead}
                    value={formatTokenCount(usage.breakdown.cacheReadTokens)}
                  />
                  <Row
                    label={labels.cacheWrite}
                    value={formatTokenCount(usage.breakdown.cacheCreationTokens)}
                  />
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" align="end" sideOffset={8}>
            <Tooltip.Popup className="rounded-lg bg-surface-1 px-2 py-1 text-xs text-text-primary shadow-md transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
              {summary}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

export type { ContextMeterProps, ContextMeterLabels }
