// Business type: a single filesystem change observed under a watched folder. `type` says what
// happened to the entry at `path`; the renderer uses it to refresh the affected part of the explorer.

export interface FileEvent {
  readonly type: 'created' | 'updated' | 'deleted'
  readonly path: string
}
