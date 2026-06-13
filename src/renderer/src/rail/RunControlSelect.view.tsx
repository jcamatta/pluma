// A compact Base UI Select for the composer's run controls (model / effort). Pure: the current value,
// the option list (value + already-translated label), the change handler, and the trigger's aria-label
// all arrive as props; it owns no state and touches no IPC. The trigger reads as muted footer text with
// a chevron; the popup opens upward (the composer sits at the window's bottom edge) and sizes to its
// content — alignItemWithTrigger is off so it behaves as a plain dropdown instead of a native-style
// overlapping list that would scroll in the cramped space. Each row keeps its label left-aligned with the
// selected row's check on the right, so the labels line up. Open/close animates via Motion through the
// trigger's render prop.

import { Select } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { motion } from 'motion/react'

interface SelectOption {
  readonly value: string
  readonly label: string
}

interface RunControlSelectProps {
  readonly ariaLabel: string
  readonly value: string
  readonly options: readonly SelectOption[]
  readonly onValueChange: (value: string) => void
}

export function RunControlSelect({
  ariaLabel,
  value,
  options,
  onValueChange
}: RunControlSelectProps): React.JSX.Element {
  return (
    <Select.Root
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next)
      }}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-(--line2) bg-surface-3 px-2 py-1 text-xs font-semibold text-text-secondary outline-none hover:bg-(--hover) focus-visible:ring-1 focus-visible:ring-(--line2)"
        render={<motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} />}
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={12} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner side="top" sideOffset={6} align="start" alignItemWithTrigger={false}>
          <Select.Popup className="min-w-40 rounded-xl border border-border bg-surface-1 p-1 shadow-lg outline-none">
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-default items-center justify-between gap-6 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none select-none data-highlighted:bg-(--hover) data-highlighted:text-text-primary"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

export type { RunControlSelectProps, SelectOption }
