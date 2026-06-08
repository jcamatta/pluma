// The inline name field shown for a freshly created file/folder before it has a name. It is a small
// stateful leaf (focus-on-mount, local value, commit/cancel guard), so it lives outside *.view.tsx —
// views may not call hooks. It holds no IPC; commit/cancel are passed in.

import { useEffect, useRef, useState } from 'react'
import { Input } from '@base-ui/react'

type NameInputProps = {
  readonly type: 'file' | 'directory'
  readonly placeholder: string
  readonly onCommit: (name: string) => void
  readonly onCancel: () => void
}

export function NameInput({
  type,
  placeholder,
  onCommit,
  onCancel
}: NameInputProps): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  const [value, setValue] = useState('')

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
      data-type={type}
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
      placeholder={placeholder}
      className="min-w-0 flex-1 rounded-md border border-action-primary bg-surface-1 px-2 py-1 font-ui text-sm font-semibold text-text-primary outline-none"
    />
  )
}
