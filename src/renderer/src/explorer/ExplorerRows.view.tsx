// The recursive row components of the explorer tree (folder/file rows, the per-row action buttons, and
// the inline draft row). Pure — no hooks, no IPC; everything comes through the RowContext from the
// parent ExplorerView. Rendered in our design tokens.

import { ChevronDown, FilePlus, FileText, Folder, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { IconButton } from '../components/IconButton'
import { NameInput } from './NameInput'
import type { RowContext, TreeNodeModel } from './explorer-view-types'

function RowActions({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  // Hidden until the row is hovered/focused; the `.row-actions` rule in App.css drives the reveal.
  return <span className="row-actions ml-auto flex flex-none items-center gap-px">{children}</span>
}

function DraftRow({
  type,
  depth,
  ctx
}: {
  readonly type: 'file' | 'directory'
  readonly depth: number
  readonly ctx: RowContext
}): React.JSX.Element {
  return (
    <div
      style={{ paddingLeft: 11 + depth * 15 }}
      className="mb-px flex w-full items-center gap-2 rounded-xl py-2 pr-2"
    >
      <span className="flex flex-none text-text-muted">
        {type === 'directory' ? <Folder size={16} /> : <FileText size={16} />}
      </span>
      <NameInput
        type={type}
        placeholder={ctx.labels.untitled}
        onCommit={ctx.onCommitDraft}
        onCancel={ctx.onCancelDraft}
      />
    </div>
  )
}

function FolderRowContent({
  node,
  ctx
}: {
  readonly node: TreeNodeModel
  readonly ctx: RowContext
}): React.JSX.Element {
  if (ctx.renamingPath === node.path) {
    return (
      <NameInput
        type="directory"
        placeholder={node.name}
        initialValue={node.name}
        onCommit={ctx.onCommitRename}
        onCancel={ctx.onCancelRename}
      />
    )
  }
  return (
    <>
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">
        {node.name}
      </span>
      <RowActions>
        <IconButton
          label={ctx.labels.newFile}
          onClick={() => ctx.onCreate('file', node.path)}
          stopPropagation
        >
          <FilePlus size={15} />
        </IconButton>
        <IconButton
          label={ctx.labels.newFolder}
          onClick={() => ctx.onCreate('directory', node.path)}
          stopPropagation
        >
          <FolderPlus size={15} />
        </IconButton>
        <IconButton
          label={ctx.labels.renameFolder}
          onClick={() => ctx.onStartRename(node.path)}
          stopPropagation
        >
          <Pencil size={15} />
        </IconButton>
        <IconButton
          label={ctx.labels.deleteFolder}
          onClick={() => ctx.onDelete(node.path)}
          stopPropagation
        >
          <Trash2 size={15} />
        </IconButton>
      </RowActions>
    </>
  )
}

function FolderRow({
  node,
  depth,
  ctx
}: {
  readonly node: TreeNodeModel
  readonly depth: number
  readonly ctx: RowContext
}): React.JSX.Element {
  const renaming = ctx.renamingPath === node.path
  return (
    <div>
      <div
        data-row
        data-testid={`folder-row:${node.path}`}
        onClick={renaming ? undefined : () => ctx.onToggle(node.path)}
        style={{ paddingLeft: 11 + depth * 15 }}
        className="mb-px flex w-full cursor-pointer items-center gap-2 rounded-xl py-2 pr-2 text-text-secondary transition-colors hover:bg-(--hover)"
      >
        <span
          className="flex flex-none text-text-muted transition-transform"
          style={{ transform: node.open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          <ChevronDown size={14} />
        </span>
        <span className="flex flex-none text-text-muted">
          <Folder size={16} />
        </span>
        <FolderRowContent node={node} ctx={ctx} />
      </div>
      {node.open && (
        <>
          {ctx.draft && ctx.draft.parentPath === node.path && (
            <DraftRow type={ctx.draft.type} depth={depth + 1} ctx={ctx} />
          )}
          {(node.children ?? []).map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} ctx={ctx} />
          ))}
        </>
      )}
    </div>
  )
}

function FileRowContent({
  node,
  selected,
  ctx
}: {
  readonly node: TreeNodeModel
  readonly selected: boolean
  readonly ctx: RowContext
}): React.JSX.Element {
  if (ctx.renamingPath === node.path) {
    return (
      <NameInput
        type="file"
        placeholder={node.name}
        initialValue={node.name}
        onCommit={ctx.onCommitRename}
        onCancel={ctx.onCancelRename}
      />
    )
  }
  return (
    <>
      <span
        className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm ${
          selected ? 'font-semibold' : 'font-medium'
        }`}
      >
        {node.name}
      </span>
      <RowActions>
        <IconButton
          label={ctx.labels.renameFile}
          onClick={() => ctx.onStartRename(node.path)}
          stopPropagation
        >
          <Pencil size={15} />
        </IconButton>
        <IconButton
          label={ctx.labels.deleteFile}
          onClick={() => ctx.onDelete(node.path)}
          stopPropagation
        >
          <Trash2 size={15} />
        </IconButton>
      </RowActions>
    </>
  )
}

function FileRow({
  node,
  depth,
  ctx
}: {
  readonly node: TreeNodeModel
  readonly depth: number
  readonly ctx: RowContext
}): React.JSX.Element {
  const selected = ctx.selected === node.path
  const renaming = ctx.renamingPath === node.path
  return (
    <div
      data-row
      data-testid={`file-row:${node.path}`}
      onClick={renaming ? undefined : () => ctx.onSelect(node.path)}
      style={{ paddingLeft: 11 + depth * 15 }}
      className={`mb-px flex w-full cursor-pointer items-center gap-2 rounded-xl border py-2 pr-2 transition-colors ${
        selected
          ? 'border-action-primary bg-[color-mix(in_srgb,var(--color-action-primary)_10%,transparent)] text-text-primary shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-action-primary)_18%,transparent)]'
          : 'border-transparent text-text-secondary hover:bg-(--hover)'
      }`}
    >
      <span className={`flex flex-none ${selected ? 'text-action-primary' : 'text-text-muted'}`}>
        <FileText size={16} />
      </span>
      <FileRowContent node={node} selected={selected} ctx={ctx} />
    </div>
  )
}

function TreeNode({
  node,
  depth,
  ctx
}: {
  readonly node: TreeNodeModel
  readonly depth: number
  readonly ctx: RowContext
}): React.JSX.Element {
  if (node.type === 'directory') {
    return <FolderRow node={node} depth={depth} ctx={ctx} />
  }
  return <FileRow node={node} depth={depth} ctx={ctx} />
}

export { TreeNode, DraftRow }
