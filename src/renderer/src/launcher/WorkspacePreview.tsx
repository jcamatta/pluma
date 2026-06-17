// The animated skeleton shown on the right of the launcher: a low-fidelity preview of the workspace a
// user lands in after picking a folder — a slim explorer column, the open page (shimmer lines only),
// and the assistant chat rail (header, Chat/Review tabs, sparkle empty state, composer). Pure visual
// component (no state, no IPC). Every shimmer line pulses on a staggered loop via Motion so the preview
// feels alive without being literal.

import { useTranslation } from 'react-i18next'
import { ArrowUp, Folder, Sparkles } from 'lucide-react'
import { Shimmer } from '../components/Shimmer'

const EXPLORER_ROWS = [0, 0.15, 0.3, 0.45, 0.6] as const
const PAGE_LINES = [0.2, 0.35, 0.5, 0.65] as const

function ExplorerColumn(): React.JSX.Element {
  return (
    <div className="hidden w-40 flex-none flex-col gap-3 rounded-2xl bg-surface-3 p-4 sm:flex">
      <Shimmer className="h-2 w-16 rounded-full bg-(--line3)" delay={0} />
      <div className="mt-2 flex flex-col gap-3">
        {EXPLORER_ROWS.map((delay, index) => (
          <div key={delay} className="flex items-center gap-2">
            {index === 0 ? (
              <Folder aria-hidden="true" className="size-3 text-action-primary" />
            ) : (
              <span aria-hidden="true" className="size-3 flex-none" />
            )}
            <Shimmer className="h-2 flex-1 rounded-full bg-(--line2)" delay={delay} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PageColumn(): React.JSX.Element {
  return (
    <div className="relative flex min-w-0 flex-1 flex-col gap-4 rounded-2xl bg-surface-3 p-6">
      <div className="mt-2 flex flex-col gap-3">
        {PAGE_LINES.map((delay) => (
          <Shimmer key={delay} className="h-3 w-full rounded-full bg-(--line2)" delay={delay} />
        ))}
        <Shimmer className="h-3 w-2/3 rounded-full bg-(--line2)" delay={0.8} />
      </div>
    </div>
  )
}

function ChatColumn(): React.JSX.Element {
  return (
    <div className="hidden w-44 flex-none flex-col rounded-2xl bg-surface-3 lg:flex">
      <div className="flex items-center gap-2 border-b border-(--line) p-4">
        <Shimmer className="h-2 w-14 rounded-full bg-(--line3)" delay={0.1} />
        <span aria-hidden="true" className="ml-auto size-2 rounded-full bg-action-primary" />
      </div>
      <div className="flex gap-2 border-b border-(--line) px-4 py-3">
        <span aria-hidden="true" className="h-5 w-12 rounded-lg bg-action-primary opacity-80" />
        <Shimmer className="h-5 w-12 rounded-lg bg-(--line2)" delay={0.3} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <Sparkles aria-hidden="true" className="size-5 text-text-muted opacity-55" />
        <Shimmer className="h-2 w-24 rounded-full bg-(--line2)" delay={0.5} />
        <Shimmer className="h-2 w-16 rounded-full bg-(--line2)" delay={0.65} />
      </div>
      <div className="m-4 flex items-center gap-2 rounded-xl border border-(--line) bg-surface-2 p-3">
        <Shimmer className="h-2 flex-1 rounded-full bg-(--line2)" delay={0.8} />
        <span
          aria-hidden="true"
          className="flex size-5 flex-none items-center justify-center rounded-full bg-action-primary text-text-on-accent opacity-80"
        >
          <ArrowUp className="size-3" />
        </span>
      </div>
    </div>
  )
}

function WorkspacePreview(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      aria-label={t('launcher.preview')}
      role="img"
      className="flex h-full w-full items-stretch gap-3 overflow-hidden p-6 font-ui"
    >
      <ExplorerColumn />
      <PageColumn />
      <ChatColumn />
    </div>
  )
}

export { WorkspacePreview }
