import { sendPush } from '../../../lib/push'

export const dynamic = 'force-dynamic'

// Warnung aufs Handy, wenn eine Konfigurator-Anfrage nicht bei Make ankommt
const ORIGINS = ['https://neonframe.de', 'https://www.neonframe.de', 'https://atcbcn-sh.myshopify.com']
const cors = req => {
  const o = req.headers.get('origin') || ''
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: cors(req) })
}

export async function POST(req) {
  const headers = cors(req)
  if (!ORIGINS.includes(req.headers.get('origin') || '')) return Response.json({ error: 'Nicht erlaubt' }, { status: 403, headers })
  let b = {}
  try { b = await req.json() } catch {}
  const c = s => String(s || '').slice(0, 120)
  const kunde = [c(b.name) || 'Unbekannt', c(b.email), c(b.telefon)].filter(Boolean).join(' · ')
  await sendPush({ title: '⚠️ Make: Anfrage nicht angekommen', body: `${kunde}\n${c(b.why)} · Bitte Kunden direkt melden und Make prüfen.`, tag: 'make-alert-' + Date.now() }).catch(() => {})
  return Response.json({ success: true }, { headers })
}
