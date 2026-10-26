// TEST: zeigt, was die DHL-Schnittstelle zu einer Sendungsnummer meldet (nur lesen)
// Aufruf: /api/dhl-test?key=DEIN_CRON_SECRET&num=JVGL06275671001499592562
export const dynamic = 'force-dynamic'

export async function GET(req) {
  const u = new URL(req.url)
  if (!process.env.CRON_SECRET || u.searchParams.get('key') !== process.env.CRON_SECRET) return Response.json({ error: 'Nicht erlaubt' }, { status: 401 })
  if (!process.env.DHL_API_KEY) return Response.json({ error: 'DHL_API_KEY fehlt' }, { status: 500 })
  const num = String(u.searchParams.get('num') || '').trim()
  const r = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(num)}&language=de`, {
    headers: { 'DHL-API-Key': process.env.DHL_API_KEY, Accept: 'application/json' }, cache: 'no-store',
  })
  const j = await r.json().catch(() => ({}))
  const s = j.shipments?.[0]
  return Response.json({
    http: r.status,
    gefunden: !!s,
    service: s?.service || null,
    statusCode: s?.status?.statusCode || null,
    status: s?.status?.status || null,
    beschreibung: s?.status?.description || null,
    letzteEreignisse: (s?.events || []).slice(0, 5).map(e => ({ zeit: e.timestamp, code: e.statusCode, text: e.description || e.status })),
    fehler: s ? null : (j.detail || j.title || null),
  })
}
