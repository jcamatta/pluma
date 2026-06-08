// Pure file-explorer panel, ported from the design (.references/pluma-design Explorer). Holds no hooks
// and no IPC; data, callbacks, and resolved label strings all come through props from
// Explorer.controller. The recursive rows live in ExplorerRows.view. Rendered in our design tokens.

import { FilePlus, FolderPlus, PanelLeft } from 'lucide-react'
import { IconButton } from '../components/IconButton'
import { Scrollable } from '../components/Scrollable'
import { DraftRow, TreeNode } from './ExplorerRows.view'
import type {
  DraftNode,
  ExplorerCallbacks,
  ExplorerLabels,
  RowContext,
  TreeNodeModel
} from './explorer-view-types'

type ExplorerViewProps = ExplorerCallbacks & {
  readonly labels: ExplorerLabels
  readonly tree: readonly TreeNodeModel[]
  readonly selected: string | null
  readonly draft: DraftNode | null
}

export function ExplorerView(props: ExplorerViewProps): React.JSX.Element {
  const { labels, tree, selected, draft, onClose, onCreate } = props
  const ctx: RowContext = {
    labels,
    selected,
    draft,
    onClose,
    onSelect: props.onSelect,
    onToggle: props.onToggle,
    onCreate,
    onDelete: props.onDelete,
    onCommitDraft: props.onCommitDraft,
    onCancelDraft: props.onCancelDraft
  }

  return (
    <div
      data-testid="explorer"
      className="flex h-full flex-col rounded-2xl bg-surface-3"
      style={{ width: 'var(--explorer-w)' }}
    >
      <div className="flex items-center gap-px border-b border-(--line) py-4 pl-4 pr-3 pt-5">
        <span className="text-base font-bold tracking-tight">{labels.title}</span>
        <span className="ml-auto flex items-center gap-px">
          <IconButton label={labels.newFile} onClick={() => onCreate('file', null)}>
            <FilePlus size={17} />
          </IconButton>
          <IconButton label={labels.newFolder} onClick={() => onCreate('directory', null)}>
            <FolderPlus size={17} />
          </IconButton>
          <IconButton label={labels.collapse} onClick={onClose} className="rounded-lg">
            <PanelLeft size={17} />
          </IconButton>
        </span>
      </div>
      <Scrollable className="min-h-0 flex-1" contentClassName="px-3 pb-6 pt-3">
        {draft && draft.parentPath === null && <DraftRow type={draft.type} depth={0} ctx={ctx} />}
        {tree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} ctx={ctx} />
        ))}
        {tree.length === 0 && !draft && (
          <div className="px-4 py-6 text-sm leading-relaxed text-text-muted">{labels.empty}</div>
        )}
      </Scrollable>
    </div>
  )
}
