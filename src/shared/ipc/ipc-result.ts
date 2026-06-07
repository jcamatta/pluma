// The plain discriminated union returned by every request/response IPC endpoint. Effect types never
// cross IPC; a main handler runs its use case and serializes the success/failure into this value, and
// the renderer receives exactly this. Lives in shared so both the main ipc layer and the preload
// bridge cite one definition.

export type Result<T, E extends { _tag: string }> = { ok: true; value: T } | { ok: false; error: E }
