import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/600.css'
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/400-italic.css'
import '@fontsource/source-serif-4/600.css'

import './App.css'
import './i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { invariant } from '../../shared/invariant'
import { App } from './App'
import { RepositoriesProvider } from './explorer/RepositoriesProvider'
import { ThreadsProvider } from './threads/ThreadsProvider'
import { initSettings } from './settings/settings'

// Apply the stored theme before the first paint so the app does not flash the default palette.
initSettings()

const queryClient = new QueryClient()

const rootElement = document.getElementById('root')
invariant(rootElement, 'Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RepositoriesProvider>
        <ThreadsProvider>
          <App />
        </ThreadsProvider>
      </RepositoriesProvider>
    </QueryClientProvider>
  </StrictMode>
)
