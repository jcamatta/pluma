// Narrows an unknown to an indexable record so field checks downstream read each property as `unknown`
// rather than needing a cast. The shared primitive both shape guards build on.

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export { isObject }
