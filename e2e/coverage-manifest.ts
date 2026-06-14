// The single source of truth the e2e audit enforces. It lists every *shipped* UI feature and every
// shipped user-facing operation (one per real IPC channel the UI drives). `npm run test` runs the
// audit (e2e/__tests__/audit.test.ts), which fails unless each id here is claimed by at least one spec
// via an `@e2e` header tag.
//
// This is how we "force e2e to exist": you do NOT pre-list unbuilt features here. When a feature ships,
// the SAME change adds its id (and its operations) to these lists AND a real-app *.e2e.ts spec that
// claims them — otherwise the audit goes red. So the manifest grows in lockstep with the app, the gate
// stays green incrementally, and nothing ships without a spec that drives the real desktop app.
//
// A shipped UI feature (a screen/region of the conversation layout).
const FEATURES = [
  'launcher',
  'explorer',
  'editor',
  'editor-tabs',
  'editor-external-sync',
  'workspace-open',
  'settings',
  'rail',
  'rail-context-meter',
  'thread-history',
  'artifacts',
  'artifacts-cross-file'
] as const

// A shipped user-facing operation, one per real IPC channel the UI exercises end to end.
const OPERATIONS = [
  'folder.pick',
  'folder.list',
  'folder.create',
  'folder.delete',
  'folder.rename',
  'folder.watch',
  'folder.changed',
  'file.create',
  'file.delete',
  'file.rename',
  'file.read',
  'file.write',
  'agent.run',
  'agent.event',
  'agent.abort',
  'agent.list-threads',
  'agent.thread-history',
  'agent.thread-context',
  'agent.rename-thread',
  'agent.delete-thread'
] as const

type Feature = (typeof FEATURES)[number]
type Operation = (typeof OPERATIONS)[number]

export { FEATURES, OPERATIONS, type Feature, type Operation }
