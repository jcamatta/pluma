// Runs a measurement `count` times, strictly in sequence, and returns the raw samples. Sequencing
// matters: perf measurements must not overlap or they perturb each other, so this awaits each iteration
// before starting the next. Built by recursion over an immutable accumulator — no shared mutable state.

const collectSamples = async (
  count: number,
  measure: (iteration: number) => Promise<number>
): Promise<readonly number[]> => {
  const run = async (i: number, acc: readonly number[]): Promise<readonly number[]> =>
    i >= count ? acc : run(i + 1, [...acc, await measure(i)])
  return run(0, [])
}

export { collectSamples }
