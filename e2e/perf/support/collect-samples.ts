// Runs a measurement `count` times, strictly in sequence, and returns the raw results. Sequencing
// matters: perf measurements must not overlap or they perturb each other, so this awaits each iteration
// before starting the next. Built by recursion over an immutable accumulator — no shared mutable state.
// Generic over the result type: most scenarios collect a single number per iteration, but some collect a
// small record (e.g. heap and RSS together).

const collectSamples = async <T>(
  count: number,
  measure: (iteration: number) => Promise<T>
): Promise<readonly T[]> => {
  const run = async (i: number, acc: readonly T[]): Promise<readonly T[]> =>
    i >= count ? acc : run(i + 1, [...acc, await measure(i)])
  return run(0, [])
}

export { collectSamples }
