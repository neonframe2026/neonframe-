import { addAlert, getAlerts, dismissAlert } from '../../../lib/alerts'
import { requireUser } from '../../../lib/api-auth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// POST  (vom Konfigurator)  -> Warnung: Anfrage nicht bei Make angekommen
// GET   (Zentrale)          -> alle offenen Warnungen für die Glocke
// PATCH ?id=... (Zentrale)  -> Warnung schließen
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
  await addAlert({ kind: 'make', title: '⚠️ Make: Anfrage nicht angekommen', body: `${kunde} · ${c(b.why)} · Bitte Kunden direkt melden und Make prüfen.` })
  return Response.json({ success: true }, { headers })
}

export async function GET(req) {
  const no = await requireUser(req); if (no) return no
  return Response.json(await getAlerts())
}

export async function PATCH(req) {
  const no = await requireUser(req); if (no) return no
  const id = new URL(req.url).searchParams.get('id')
  if (id) await dismissAlert(id)
  return Response.json({ success: true })
}
