// The single sanctioned throw in the codebase. Asserts a programmer invariant: if the condition is
// falsy the app is wired wrong and cannot continue, so we throw. Business failures are never modeled
// this way — they return a Result ({ ok: false, error }). The `asserts condition` signature narrows
// the checked value for callers, so guards keep their type-narrowing without `!` or `as`.

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export { invariant }
