// Data: the closed vocabulary of run failures the application recognises — only the ones the app acts
// on differently; everything else is 'generic'. The wire layer declares the same set for itself because
// the application may not import src/shared, and a test in src/main/ipc — the one layer allowed to see
// both — pins the two equal.

const RUN_FAILURES = ['authentication', 'generic'] as const

type RunFailure = (typeof RUN_FAILURES)[number]

export { RUN_FAILURES }
export type { RunFailure }
