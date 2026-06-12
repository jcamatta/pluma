// A compact Base UI Select for the composer's run controls (model / effort). Pure: the current value,
// the option list (value + already-translated label), the change handler, and the trigger's aria-label
// all arrive as props; it owns no state and touches no IPC. The trigger reads as muted footer text with
// a chevron; the popup lists the options with a check on the selected one. Open/close animates via Motion
// through the trigger's render prop.

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
        className="flex items-center gap-1 rounded-lg border border-(--line2) bg-surface-3 px-2 py-1 text-xs font-semibold text-text-secondary"
        render={<motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} />}
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={12} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} align="start">
          <Select.Popup className="rounded-xl border border-border bg-surface-1 p-1 shadow-lg">
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1 text-sm text-text-secondary data-highlighted:bg-(--hover) data-selected:text-text-primary"
                >
                  <Select.ItemIndicator>
                    <Check size={13} />
                  </Select.ItemIndicator>
                  <Select.ItemText>{option.label}</Select.ItemText>
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
