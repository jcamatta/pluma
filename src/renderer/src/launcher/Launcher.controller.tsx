// Wires the folder.pick command hook and the launcher's translated labels to the launcher view. Holds
// no layout of its own: it turns the hook's async pick into the plain onPick the view calls, resolves
// the call-to-action strings via t, and reports the chosen folder up via onPicked so the app shell can
// mount the workspace for that root.

import { useTranslation } from 'react-i18next'
import { useFolderPick } from './useFolderPick'
import { Launcher } from './Launcher.view'
import type { LauncherLabels } from './Launcher.view'

type LauncherControllerProps = {
  readonly onPicked: (path: string) => void
}

function LauncherController({ onPicked }: LauncherControllerProps): React.JSX.Element {
  const { t } = useTranslation()
  const { pick } = useFolderPick(onPicked)
  const labels: LauncherLabels = {
    wordmark: t('launcher.wordmark'),
    heading: t('launcher.heading'),
    description: t('launcher.description'),
    openFolder: t('launcher.openFolder')
  }
  return <Launcher labels={labels} onPick={() => void pick()} />
}

export { LauncherController }
export type { LauncherControllerProps }
