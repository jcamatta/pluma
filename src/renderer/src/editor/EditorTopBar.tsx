// The editor panel's top bar, ported from the design (.references/pluma-design editor tab bar). It is the
// panel's chrome — layout above the editor surface, not the editor instance — so it lives in the editor
// feature and is composed by the app shell, a sibling of the EditorController. Shows the open file's name
// with its accent underline on the left and a settings button at the right edge. Pure props: the name and
// label strings and the open-settings callback come from the shell. Opening the settings modal itself is a
// later task — this only renders the trigger.

import { FileText, Settings } from 'lucide-react'
import { IconButton } from '../components/IconButton'

type EditorTopBarProps = {
  readonly fileName: string
  readonly settingsLabel: string
  readonly onOpenSettings: () => void
}

export function EditorTopBar({
  fileName,
  settingsLabel,
  onOpenSettings
}: EditorTopBarProps): React.JSX.Element {
  return (
    <div className="flex h-12 flex-none items-stretch border-b border-(--line)">
      <div className="relative flex items-center gap-2 whitespace-nowrap px-4 text-sm font-semibold text-text-primary">
        <FileText size={15} className="text-text-muted" />
        {fileName}
        <span
          className="absolute inset-x-0 -bottom-px rounded-sm bg-action-primary"
          style={{ height: 2 }}
        />
      </div>
      <div className="flex flex-1 items-center justify-end pr-3">
        <IconButton label={settingsLabel} onClick={onOpenSettings} className="rounded-lg p-2">
          <Settings size={17} />
        </IconButton>
      </div>
    </div>
  )
}
