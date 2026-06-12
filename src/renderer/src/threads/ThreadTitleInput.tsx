// Inline title field for renaming a thread: a small stateful leaf (focus+select on mount, local value,
// commit/cancel guard) seeded with the thread's current title. Lives outside *.view.tsx since views may
// not call hooks. Holds no IPC; commit/cancel are passed in. Clicks are stopped so editing the title
// does not also select the row.

import { useEffect, useRef, useState } from 'react'
import { Input } from '@base-ui/react'

interface ThreadTitleInputProps {
  readonly initialValue: string
  readonly onCommit: (title: string) => void
  readonly onCancel: () => void
}

export function ThreadTitleInput({
  initialValue,
  onCommit,
  onCancel
}: ThreadTitleInputProps): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    const el = ref.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const commit = (raw: string): void => {
    if (done.current) return
    done.current = true
    onCommit(raw.trim())
  }
  const cancel = (): void => {
    if (done.current) return
    done.current = true
    onCancel()
  }

  return (
    <Input
      ref={ref}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit(value)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
      }}
      onBlur={() => commit(value)}
      className="min-w-0 flex-1 rounded-md border border-action-primary bg-surface-2 px-2 py-1 font-ui text-sm text-text-primary outline-none"
    />
  )
}

export type { ThreadTitleInputProps }
