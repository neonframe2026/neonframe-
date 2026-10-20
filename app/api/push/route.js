import webpush from 'web-push'
import { sendPush, pushDb } from '../../../lib/push'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET ?keys=1          -> einmalig neue Schlüssel erzeugen (nur solange noch keine in Vercel eingetragen sind)
// GET                  -> öffentlicher Schlüssel fürs Handy
// POST { sub }         -> Handy anmelden            (angemeldet)
// POST { test: true }  -> Test-Nachricht senden     (angemeldet)
async function user(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  const { data, error } = await pushDb().auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  return data.user
}

export async function GET(req) {
  const sp = new URL(req.url).searchParams
  if (sp.get('keys')) {
    if (process.env.VAPID_PRIVATE_KEY) return Response.json({ error: 'Schlüssel sind schon eingerichtet' }, { status: 400 })
    const k = webpush.generateVAPIDKeys()
    return Response.json({ VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey, hinweis: 'Beide Werte in Vercel eintragen, dann Redeploy. Diese Seite danach schließen.' })
  }
  return Response.json({ key: process.env.VAPID_PUBLIC_KEY || null })
}

export async function POST(req) {
  try {
    const u = await user(req)
    const b = await req.json()
    if (b.test) return Response.json(await sendPush({ title: 'NeonFrame Zentrale', body: 'Push funktioniert! Ab jetzt melden sich Lisa, Tom, Emma und Anna hier.', tag: 'test' }))
    const sub = b.sub
    if (!sub?.endpoint) return Response.json({ error: 'Kein Gerät' }, { status: 400 })
    const { error } = await pushDb().from('push_subs').upsert({ endpoint: sub.endpoint, sub, user_id: u.id }, { onConflict: 'endpoint' })
    if (error) throw new Error(error.message)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: err.status || 500 })
  }
}
