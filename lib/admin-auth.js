import { createClient } from '@supabase/supabase-js'

// Login für den Admin (Supabase Auth, E-Mail + Passwort)
// "Angemeldet bleiben" an  -> Sitzung bleibt im Browser gespeichert
// "Angemeldet bleiben" aus -> Sitzung endet, wenn der Browser geschlossen wird
const remember = () => { try { return localStorage.getItem('nf_remember') !== '0' } catch { return true } }
const storage = {
  getItem: (k) => { try { return (remember() ? localStorage : sessionStorage).getItem(k) } catch { return null } },
  setItem: (k, v) => { try { (remember() ? localStorage : sessionStorage).setItem(k, v) } catch {} },
  removeItem: (k) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k) } catch {} },
}

let client = null
export function authClient() {
  if (typeof window === 'undefined') return null
  if (!client) client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { storage, storageKey: 'nf-admin-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}
export function setRemember(on) { try { localStorage.setItem('nf_remember', on ? '1' : '0') } catch {} }
export async function authSignOut() { try { await authClient()?.auth.signOut() } catch {} }
