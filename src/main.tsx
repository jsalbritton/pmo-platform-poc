import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from '@/App'
import '@/index.css'

/**
 * QueryClient — the central cache for all server state.
 *
 * staleTime: 5 min — data fetched less than 5 minutes ago is considered
 * "fresh" and won't be refetched even if a component remounts.
 *
 * gcTime: 10 min — unused/inactive cached data is garbage-collected after
 * 10 minutes. Keeps memory clean without losing useful cache too early.
 *
 * retry: 2 — failed requests are retried twice before the error state shows.
 *
 * refetchOnWindowFocus: true — when the user tabs back to the app, stale
 * queries are refetched in the background. Dashboard data stays current.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* DevTools panel — only bundled in development, zero-cost in production */}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>
)
