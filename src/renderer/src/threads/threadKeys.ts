// The React Query keys for the threads feature. Pure helpers so the query hooks and the command hooks
// (invalidation) agree on the same key shape. The workspace cwd is part of every key, so switching
// folders refetches the right list and history.

function threadsKey(cwd: string): readonly [string, string] {
  return ['threads', cwd]
}

function threadHistoryKey(cwd: string, id: string): readonly [string, string, string] {
  return ['thread-history', cwd, id]
}

function threadContextKey(cwd: string, id: string): readonly [string, string, string] {
  return ['thread-context', cwd, id]
}

export { threadsKey, threadHistoryKey, threadContextKey }
