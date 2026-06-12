// How many times a scenario repeats its measurement. We never trust a single run, so the default is 5;
// set PERF_ITERATIONS to override (e.g. more iterations for a tighter baseline, fewer for a quick look).
// Anything that is not a positive integer falls back to the default rather than failing the run.

const DEFAULT_ITERATIONS = 5

const resolveIterations = (raw: string | undefined): number => {
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_ITERATIONS
  return parsed
}

export { resolveIterations, DEFAULT_ITERATIONS }
