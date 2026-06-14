// The whole external-write sync policy as one pure decision: given the content now on disk and the
// baseline we last synced with disk, decide whether to reload the editor. disk-wins — any divergence
// from the baseline reloads. Equality is the idle case and absorbs the self-write echo: once our own
// save advances the baseline, the watcher-triggered re-read sees disk === base and does nothing. A
// null baseline (nothing synced yet) diverges from any content, so the first load reloads.

type ReconcileDecision = 'apply' | 'skip'

function reconcileFileContent(disk: string, base: string | null): ReconcileDecision {
  return disk === base ? 'skip' : 'apply'
}

export { reconcileFileContent }
export type { ReconcileDecision }
