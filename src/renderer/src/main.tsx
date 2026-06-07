import './App.css'
import './i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { invariant } from '../../shared/invariant'
import { App } from './App'

const queryClient = new QueryClient()

const rootElement = document.getElementById('root')
invariant(rootElement, 'Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
