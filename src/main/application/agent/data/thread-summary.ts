// Business type: a one-line summary of a past thread (an SDK session) for the threads list. `id` is
// the SDK session id (also the value the run path resumes), `title` is the stored or derived name (an
// empty string when neither is available — the renderer shows a localized fallback), and `updatedAt`
// is the session's last-modified time in epoch milliseconds, used to sort most-recent first.

export interface ThreadSummary {
  readonly id: string
  readonly title: string
  readonly updatedAt: number
}
