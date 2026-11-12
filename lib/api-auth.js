import { createClient } from '@supabase/supabase-js'

// Prüft, ob ein Aufruf erlaubt ist:
//  - eingeloggter Benutzer im Admin (Bearer-Token, Admin oder Mitarbeiter)
//  - oder interner Server-Aufruf (Header x-internal-key = Service-Key)
// Gibt null zurück, wenn ok, sonst eine fertige 401-Antwort.
export async function requireUser(req) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (key && req.headers.get('x-internal-key') === key) return null
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (token && key) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key)
    const { data } = await sb.auth.getUser(token)
    if (data?.user) return null
  }
  return Response.json({ error: 'Nicht angemeldet' }, { status: 401 })
}
