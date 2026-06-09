import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { queryClient } from './app/queryClient'
import { router } from './app/router'
import { isDemoHost } from './shared/env/devMode'

async function prepare() {
  if (isDemoHost()) {
    const { worker } = await import('./demo/browser')
    // Resolve the SW script URL relative to the page's base path so it works
    // both on localhost (base="/") and GitHub Pages (base="/chessreader/").
    const swUrl = `${import.meta.env.BASE_URL}mockServiceWorker.js`
    return worker.start({ serviceWorker: { url: swUrl }, onUnhandledRequest: 'bypass' })
  }
}

prepare().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
