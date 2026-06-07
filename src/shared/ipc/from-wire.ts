// The single trusted narrowing at the IPC boundary. Electron delivers event payloads (and resolves
// invoke) as untyped values; main produced them from the shared contract, so the renderer side trusts
// their shape. assertWire records that trust with an `asserts` signature — the same no-`as`, no-`!`
// narrowing tool as invariant.ts — turning an unknown wire value into its contract type for callers
// without a type assertion. It performs the one check that always holds for our payloads: every event
// payload and result is a non-null object.

import { invariant } from '../invariant'

function assertWire<T>(value: unknown, channel: string): asserts value is T {
  invariant(
    typeof value === 'object' && value !== null,
    `IPC payload for ${channel} was not an object`
  )
}

export { assertWire }
