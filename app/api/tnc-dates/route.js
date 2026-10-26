export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Test (nur Datumswerte, keine persönlichen Daten): /api/tnc-dates?id=13287430172
const BASE = 'https://panel.theneoncompany.shop'
const ISO = /^\d{4}-\d{2}-\d{2}T/
function dates(v, path, out) {
  if (typeof v === 'string' && ISO.test(v)) out[path] = v
  else if (Array.isArray(v)) v.forEach((x, i) => dates(x, `${path}[${i}]${x && x.type ? '(' + x.type + ')' : ''}`, out))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) dates(x, path ? `${path}.${k}` : k, out)
  return out
}
export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id')
  if (!/^\d{8,}$/.test(id || '')) return Response.json({ error: 'id fehlt' }, { status: 400 })
  const res = {}
  for (const [name, url] of [['cart', `/api/orders/getCart?id=${id}`], ['monday', `/api/v2/monday/get_images?id=${id}`]]) {
    try {
      const r = await fetch(BASE + url, { cache: 'no-store', headers: { Accept: 'application/json' } })
      const t = await r.text()
      let j; try { j = JSON.parse(t) } catch { res[name] = { http: r.status, keineJson: true }; continue }
      res[name] = { http: r.status, dates: dates(j, '', {}), keys: Object.keys(j?.data || j || {}).slice(0, 40) }
    } catch (e) { res[name] = { error: e.message } }
  }
  return Response.json(res)
}
