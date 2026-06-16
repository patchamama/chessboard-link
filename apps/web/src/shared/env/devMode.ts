const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '::1', '[::1]']

export function isLocalhostHost(): boolean {
  return LOCAL_HOSTNAMES.includes(window.location.hostname)
}

/** True when running in demo mode (GitHub Pages, demo host, or VITE_DEMO=true).
 *  localhost does NOT activate demo mode — it talks to the real backend. */
export function isDemoHost(): boolean {
  if (import.meta.env.VITE_DEMO === 'true') return true
  const h = window.location.hostname
  return h.endsWith('.github.io') || h === 'demo.chessreader.app'
}

/** True in a developer context: Vite dev build or running on localhost.
 *  Used to surface dev-only tooling (e.g. the recognition debug panel) even when
 *  the logged-in user is not an admin. */
export function isDevMode(): boolean {
  return import.meta.env.DEV || isLocalhostHost()
}
