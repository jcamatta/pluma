// A minimal fake of window.api for explorer tests. Backed by vi.fn() mocks installed via vi.stubGlobal
// (which accepts an unknown value, so no casts are needed). `invoke` dispatches to a per-channel handler
// map; `on` records listeners by channel so tests can emit events (e.g. folder:changed). The code under
// test sees a real window.api shape at runtime; tests drive it through the returned helpers.

import { vi } from 'vitest'

type InvokeHandler = (input: unknown) => unknown

type FakeApi = {
  readonly emit: (channel: string, payload: unknown) => void
  readonly calls: () => ReadonlyArray<{ readonly channel: string; readonly input: unknown }>
}

function installFakeWindowApi(handlers: Record<string, InvokeHandler>): FakeApi {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  const calls: Array<{ readonly channel: string; readonly input: unknown }> = []

  const invoke = vi.fn((channel: string, input?: unknown) => {
    calls.push({ channel, input })
    const handler = handlers[channel]
    return Promise.resolve(handler ? handler(input) : { ok: false, error: { _tag: 'NoHandler' } })
  })

  const on = vi.fn((channel: string, callback: (payload: unknown) => void) => {
    const set = listeners.get(channel) ?? new Set<(payload: unknown) => void>()
    set.add(callback)
    listeners.set(channel, set)
    return () => set.delete(callback)
  })

  // Stub only window.api, leaving the rest of the jsdom window (document, etc.) intact. In jsdom
  // window === globalThis, so stubbing the global `api` exposes it as window.api; vi.unstubAllGlobals
  // restores it between tests.
  vi.stubGlobal('api', { invoke, on })

  return {
    emit: (channel, payload) => listeners.get(channel)?.forEach((cb) => cb(payload)),
    calls: () => calls
  }
}

export { installFakeWindowApi, type FakeApi }
