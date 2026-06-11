// Business type: the arguments for renaming a thread — the workspace `cwd` the session is keyed under,
// the thread `id` (SDK session id), and the new `title` the user typed. Bundled into one record so the
// writer port and rename use case stay within the two-parameter limit and share one shape.

export interface RenameThreadInput {
  readonly cwd: string
  readonly id: string
  readonly title: string
}
