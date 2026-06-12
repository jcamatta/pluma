// Reveals a freshly sent message: returns a ref to attach to the user bubble, and scrolls it into view
// whenever `prompt` changes. Keyed on the prompt (not the assistant's streaming reply), so a new user
// turn scrolls but assistant deltas never steal the scroll. block:'end' + the bubble's scroll-margin
// land it near the bottom with room beneath for the reply to appear.

import { useEffect, useRef } from 'react'

export function useScrollSentMessageIntoView(
  prompt: string | null
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (prompt === null) return
    ref.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [prompt])

  return ref
}
