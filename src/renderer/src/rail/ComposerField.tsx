// The composer's growing textarea. A plain component (it owns a ref + layout effect — local DOM
// behavior, not a view's concern) so RailComposer.view stays pure. The textarea is overflow-hidden and
// auto-grows in JS to its content height; once it passes the Scrollable's max height the Base UI
// ScrollArea takes over and the wheel scrolls the overflow. (CSS field-sizing grows the textarea but
// leaves the ScrollArea unaware of the overflow, so the wheel can't scroll — hence the JS height.)

import { useContext, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { Scrollable } from '../components/Scrollable'
import { ComposerFocusContext } from './ComposerFocusContext'

interface ComposerFieldProps {
  readonly placeholder: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

export function ComposerField({
  placeholder,
  value,
  onChange,
  onKeyDown
}: ComposerFieldProps): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  // The composer works on its own; the focus seam is an optional enhancement, so register only when the
  // shell provides it (it always does in the app). The consumer that needs it — the Ctrl/Cmd+K bridge —
  // hard-requires the provider via useComposerFocus.
  const composerFocus = useContext(ComposerFocusContext)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (textarea === null) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  // Register this textarea as the composer the shell can focus imperatively (the Ctrl/Cmd+K shortcut).
  // A layout effect, not a passive one, so the handle is in place before the shortcut's next-frame focus
  // runs when it opens a previously-collapsed rail.
  useLayoutEffect(() => {
    if (!composerFocus) return
    composerFocus.register({
      focus: () => textareaRef.current?.focus(),
      isFocused: () =>
        textareaRef.current !== null && document.activeElement === textareaRef.current
    })
    return () => composerFocus.register(null)
  }, [composerFocus])

  return (
    <Scrollable className="max-h-40">
      <textarea
        data-rail-composer
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={2}
        className="block w-full resize-none overflow-hidden bg-transparent px-4 pb-1 pt-3 font-ui text-sm leading-normal text-text-primary outline-none"
      />
    </Scrollable>
  )
}

export type { ComposerFieldProps }
