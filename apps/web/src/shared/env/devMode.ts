const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '::1', '[::1]']

export function isLocalhostHost(): boolean {
  return LOCAL_HOSTNAMES.includes(window.location.hostname)
}
