export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// TNC-Statusseite untersuchen (nur lesen). Test: /api/tnc-status?id=11988258578
const BASE = 'https://panel.theneoncompany.shop'

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id')
  if (!/^\d{8,}$/.test(id || '')) return Response.json({ error: 'Bitte ?id=TNC-NUMMER angeben' }, { status: 400 })
  const html = await (await fetch(`${BASE}/de/product/status/${id}`, { cache: 'no-store' })).text()
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  const nd = m ? JSON.parse(m[1]) : {}
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x => x[1])
  const found = {}
  for (const src of scripts.filter(s => /pages\/|_app/.test(s))) {
    try {
      const js = await (await fetch(src.startsWith('http') ? src : BASE + src, { cache: 'no-store' })).text()
      const apis = [...new Set([...js.matchAll(/["'`]([^"'`\s]*\/api\/[^"'`\s]{2,80})["'`]/g)].map(x => x[1]))]
      if (apis.length) found[src] = apis.slice(0, 60)
    } catch (e) { found[src] = 'Fehler: ' + e.message }
  }
  return Response.json({ page: nd.page, query: nd.query, buildId: nd.buildId, gssp: nd.gssp, scripts, apis: found })
}
