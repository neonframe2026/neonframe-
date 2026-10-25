export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// TNC-Statusseite auslesen (nur lesen). Test: /api/tnc-status?id=11988258578
const BASE = 'https://panel.theneoncompany.shop'
const trim = v => typeof v === 'string' ? (v.length > 200 ? v.slice(0, 200) + '…' : v)
  : Array.isArray(v) ? v.slice(0, 20).map(trim)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x)])) : v

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id')
  if (!/^\d{8,}$/.test(id || '')) return Response.json({ error: 'Bitte ?id=TNC-NUMMER angeben' }, { status: 400 })
  const res = await fetch(`${BASE}/de/product/status/${id}`, { cache: 'no-store' })
  const html = await res.text()
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return Response.json({ error: 'Keine Daten gefunden', http: res.status, start: html.slice(0, 500) }, { status: 502 })
  return Response.json(trim(JSON.parse(m[1]).props?.pageProps || {}))
}
