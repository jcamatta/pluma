// Test harness for explorer controllers/hooks: wraps a subtree in a fresh QueryClient, the
// RepositoriesContext (supplying an in-memory fake), and the i18n provider — the providers the real app
// supplies, minus Electron. A new QueryClient per call keeps tests isolated; retries are off so a query
// resolving (even with ok: false) settles immediately. Per AGENTS.md frontend testing.

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { RepositoriesContext } from '../RepositoriesContext'
import type { Repositories } from '../RepositoriesContext'

function ReposHarness({
  repos,
  children
}: {
  readonly repos: Repositories
  readonly children: ReactNode
}): React.JSX.Element {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RepositoriesContext.Provider value={repos}>{children}</RepositoriesContext.Provider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

export { ReposHarness }
