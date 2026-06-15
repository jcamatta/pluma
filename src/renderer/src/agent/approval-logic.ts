// Pure projection of a gated tool call's wire args (typed `unknown`) into the path(s) the approval card
// shows. The model supplies args we don't control, so each shape is read through a small type-guard and
// a mismatch yields null paths rather than throwing — the card then falls back to a generic label keyed
// off the raw tool name. The action-label key is chosen here too so the card stays a pure renderer.

interface CreatePaths {
  readonly kind: 'create'
  readonly path: string
}

interface RenamePaths {
  readonly kind: 'rename'
  readonly oldPath: string
  readonly newPath: string
}

interface DeletePaths {
  readonly kind: 'delete'
  readonly path: string
}

interface UnknownPaths {
  readonly kind: 'unknown'
}

type ApprovalPaths = CreatePaths | RenamePaths | DeletePaths | UnknownPaths

function hasStringProp<K extends string>(value: unknown, key: K): value is Record<K, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    key in value &&
    typeof Reflect.get(value, key) === 'string'
  )
}

function describeApproval(toolName: string, args: unknown): ApprovalPaths {
  if (toolName === 'create_file' && hasStringProp(args, 'path')) {
    return { kind: 'create', path: args.path }
  }
  if (
    toolName === 'rename_file' &&
    hasStringProp(args, 'oldPath') &&
    hasStringProp(args, 'newPath')
  ) {
    return { kind: 'rename', oldPath: args.oldPath, newPath: args.newPath }
  }
  if (toolName === 'delete_file' && hasStringProp(args, 'path')) {
    return { kind: 'delete', path: args.path }
  }
  return { kind: 'unknown' }
}

export { describeApproval }
export type { ApprovalPaths, CreatePaths, RenamePaths, DeletePaths, UnknownPaths }
