import { authClient } from './admin-auth'

// Schickt bei jedem Aufruf an /api/... automatisch den Login (Bearer-Token) mit.
// So müssen die vielen fetch-Aufrufe im Admin nicht einzeln geändert werden.
if (typeof window !== 'undefined' && !window.__nfAuthFetch) {
  window.__nfAuthFetch = true
  const orig = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || ''
      const own = url.startsWith('/api/') || url.startsWith(window.location.origin + '/api/')
      if (own) {
        const h = new Headers(init.headers || (typeof input !== 'string' && input ? input.headers : undefined))
        if (!h.has('authorization')) {
          const { data } = await authClient().auth.getSession()
          const t = data?.session?.access_token
          if (t) { h.set('Authorization', 'Bearer ' + t); init = { ...init, headers: h } }
        }
      }
    } catch {}
    return orig(input, init)
  }
}
