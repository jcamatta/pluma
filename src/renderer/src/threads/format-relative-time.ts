// Pure calculation: render how long ago an instant `from` (epoch ms) was relative to `now` (epoch ms),
// localized via Intl.RelativeTimeFormat for the given language. Time itself is an action captured by the
// caller (Date.now()); given both instants and the locale this is deterministic. Steps down through
// seconds → minutes → hours → days so a thread's last-activity reads naturally ("2 hours ago").

interface RelativeTimeArgs {
  readonly from: number
  readonly now: number
  readonly locale: string
}

function formatRelativeTime({ from, now, locale }: RelativeTimeArgs): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const seconds = Math.round((from - now) / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(seconds / 3600)
  const days = Math.round(seconds / 86400)
  if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second')
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(days, 'day')
}

export { formatRelativeTime }
export type { RelativeTimeArgs }
