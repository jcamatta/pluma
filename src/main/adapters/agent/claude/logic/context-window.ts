// Calculation: the context-window size (in tokens) for a model id. Both models Pluma offers —
// claude-opus-4-8 and claude-sonnet-4-6 — have a native 1M-token window; any unknown id falls back to
// the conservative 200k baseline. Used to turn the model a run is using into the denominator of the
// context meter. Pure, so it is unit-testable without the SDK.

const WINDOWS: ReadonlyMap<string, number> = new Map([
  ['claude-opus-4-8', 1_000_000],
  ['claude-sonnet-4-6', 1_000_000]
])

const DEFAULT_WINDOW = 200_000

function contextWindowForModel(model: string): number {
  return WINDOWS.get(model) ?? DEFAULT_WINDOW
}

export { contextWindowForModel, DEFAULT_WINDOW }
