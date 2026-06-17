// The explorer's loading skeleton: a few pulsing placeholder rows shown while the root folder listing is
// still loading, so the panel doesn't flash its "no files" empty state before the tree arrives. Pure
// visual; mirrors the file-row layout (icon slot + label bar). Announced as a status via the labelled
// container; the shimmer bars themselves are decorative (aria-hidden, from the shared Shimmer).

import { Shimmer } from '../components/Shimmer'

const ROWS = [
  { delay: 0, width: 'w-3/4' },
  { delay: 0.12, width: 'w-1/2' },
  { delay: 0.24, width: 'w-2/3' },
  { delay: 0.36, width: 'w-2/5' },
  { delay: 0.48, width: 'w-3/5' }
] as const

function ExplorerSkeleton({ label }: { readonly label: string }): React.JSX.Element {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-px">
      {ROWS.map((row) => (
        <div key={row.delay} className="flex items-center gap-2 py-2 pr-2 pl-3">
          <Shimmer className="size-4 flex-none rounded bg-(--line2)" delay={row.delay} />
          <Shimmer className={`h-2 rounded-full bg-(--line2) ${row.width}`} delay={row.delay} />
        </div>
      ))}
    </div>
  )
}

export { ExplorerSkeleton }
