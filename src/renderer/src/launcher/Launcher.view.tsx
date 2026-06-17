// The launcher screen: the app's entry point before a folder is picked. Pure layout (no hooks, no IPC)
// — it receives the pick action as a prop. The call to action (wordmark, serif headline, description,
// Open Folder button) always shows; the animated WorkspacePreview skeleton sits beside it on wide
// windows and is dropped once the window is too narrow to fit both, so the CTA stays readable as the
// window resizes. Ported from the design's open-folder screen, rendered in our tokens.

import { motion } from 'motion/react'
import { Button } from '@base-ui/react'
import { Folder } from 'lucide-react'
import { WorkspacePreview } from './WorkspacePreview'

type LauncherLabels = {
  readonly wordmark: string
  readonly heading: string
  readonly description: string
  readonly openFolder: string
}

type LauncherViewProps = {
  readonly labels: LauncherLabels
  readonly onPick: () => void
}

function Launcher({ labels, onPick }: LauncherViewProps): React.JSX.Element {
  return (
    <main className="flex h-screen bg-surface-1 font-ui text-text-primary">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex w-full flex-col justify-center gap-6 overflow-y-auto px-8 py-12 sm:px-12 lg:w-1/2 lg:px-16"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
          <span className="size-2 rounded-full bg-action-primary" />
          {labels.wordmark}
        </span>
        <h1 className="font-editor text-4xl leading-tight font-semibold whitespace-pre-line text-text-primary sm:text-5xl">
          {labels.heading}
        </h1>
        <p className="max-w-md text-base leading-relaxed text-text-secondary">
          {labels.description}
        </p>
        <div className="flex flex-col items-start">
          <Button
            type="button"
            onClick={onPick}
            className="rounded-xl"
            render={
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 rounded-xl bg-action-primary px-6 py-4 text-base font-semibold text-text-on-accent shadow-(--shadow-1)"
              >
                <Folder aria-hidden="true" className="size-5" />
                {labels.openFolder}
              </motion.button>
            }
          />
        </div>
      </motion.section>

      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
        className="hidden w-1/2 items-center justify-center bg-surface-2 p-8 lg:flex"
      >
        <div className="h-full max-h-160 w-full">
          <WorkspacePreview />
        </div>
      </motion.aside>
    </main>
  )
}

export { Launcher }
export type { LauncherViewProps, LauncherLabels }
