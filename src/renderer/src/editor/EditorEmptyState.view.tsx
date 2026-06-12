// What the editor area shows when no file is open: a centered heading and hint pointing the user at the
// explorer to create one, with the same settings affordance the file top bar carries (so a no-file
// workspace never loses access to settings). Pure — every string and the open-settings callback come
// through props; no hooks, no IPC. This replaces the old phantom untitled editor, which looked writable
// but discarded whatever was typed.

import { Settings } from 'lucide-react'
import { IconButton } from '../components/IconButton'

type EditorEmptyStateProps = {
  readonly heading: string
  readonly hint: string
  readonly settingsLabel: string
  readonly onOpenSettings: () => void
}

export function EditorEmptyStateView({
  heading,
  hint,
  settingsLabel,
  onOpenSettings
}: EditorEmptyStateProps): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 flex-none items-center justify-end border-b border-(--line) pr-3">
        <IconButton label={settingsLabel} onClick={onOpenSettings} className="rounded-lg p-2">
          <Settings size={17} />
        </IconButton>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-base font-semibold text-text-secondary">{heading}</p>
        <p className="max-w-sm text-sm text-text-muted">{hint}</p>
      </div>
    </div>
  )
}
