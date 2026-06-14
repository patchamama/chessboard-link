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
