// Returns a debounced version of a callback: each call resets a timer, and the callback runs only after
// delayMs of quiet. The latest callback is held in a ref so the debounced function identity stays stable
// across renders (it depends only on delayMs), and the pending timer is cleared on unmount so a trailing
// call never fires after the component is gone.

import { useEffect, useMemo, useRef } from 'react'

function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number
): (...args: Args) => void {
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return useMemo(
    () =>
      (...args: Args): void => {
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => callbackRef.current(...args), delayMs)
      },
    [delayMs]
  )
}

export { useDebouncedCallback }
