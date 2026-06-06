// The plain discriminated union returned by every IPC endpoint. Effect types never cross IPC; an
// endpoint runs its use case and serializes success/failure into this value.

export type Result<T, E extends { _tag: string }> = { ok: true; value: T } | { ok: false; error: E }
