export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// TNC-Bestellstatus lesen (nur lesen). Test: /api/tnc-status?id=11988258578
const BASE = 'https://panel.theneoncompany.shop'
const HIDE = /address|street|zip|postal|phone|mail|city|first_?name|last_?name|company_?name|vat_?number|iban/i
const clean = (v, k = '') => HIDE.test(k) && v && typeof v !== 'object' ? '(ausgeblendet)'
  : typeof v === 'string' ? (v.length > 200 ? v.slice(0, 200) + '…' : v)
  : Array.isArray(v) ? v.slice(0, 30).map(x => clean(x))
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, HIDE.test(kk) && x && typeof x === 'object' ? '(ausgeblendet)' : clean(x, kk)])) : v

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id')
  if (!/^\d{8,}$/.test(id || '')) return Response.json({ error: 'Bitte ?id=TNC-NUMMER angeben' }, { status: 400 })
  const res = await fetch(`${BASE}/api/orders/getCart?id=${id}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
  const txt = await res.text()
  let j; try { j = JSON.parse(txt) } catch { return Response.json({ http: res.status, text: txt.slice(0, 800) }) }
  return Response.json({ http: res.status, data: clean(j) })
}
