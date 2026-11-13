import { createClient } from '@supabase/supabase-js'
import { markupFactor, getSetting } from '../../../lib/pricing'
import { shopifyOrderTotals } from '../../../lib/shopify-admin'
import { getBW } from '../../../lib/blackweek'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Statistik (nur für Administratoren): alle Bestellungen mit Umsatz brutto, Einkauf netto, Gewinn
// + Black-Week-Archiv. Fehlende Werte bei alten Bestellungen werden einmalig nachgetragen.
// Gewinn = Umsatz brutto ÷ 1,19 − Einkauf netto (TNC)
const BOUGHT = ['confirmed', 'in_production', 'shipped', 'delivered']
const r2 = n => Math.round(n * 100) / 100
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function isAdmin(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false
  const { data } = await db().auth.getUser(token)
  return data?.user?.app_metadata?.role === 'admin'
}

// Einkauf netto: gespeichert oder aus dem Angebotspreis zurückgerechnet (empf. VK ÷ 1,35)
function ekOf(o) {
  let ek = parseFloat(o.ek_net) || 0
  if (!ek) {
    const b = parseFloat(o.base_price) || 0, vat = 1 + (parseFloat(o.vat_pct) || 19) / 100
    const ld = o.black_week ? (parseFloat(o.bw_prev?.disc_val) || 20) : (parseFloat(o.disc_val) || 0)
    const list = o.disc_type === 'eur' && !o.black_week ? Math.max(0, b - ld) : b * (1 - ld / 100)
    ek = r2(list * vat / markupFactor(o) / 1.35)
  }
  if (o.express) ek = r2(ek * 1.3) // Express kostet bei TNC auch +30%
  return ek || null
}

export async function GET(req) {
  if (!(await isAdmin(req))) return Response.json({ error: 'Nur für Administratoren' }, { status: 403 })
  try {
    const sb = db()
    const { data, error } = await sb.from('offers')
      .select('id, custom_id, project, status, ordered_at, created_at, width, height, final_price, base_price, disc_type, disc_val, vat_pct, markup, black_week, bw_prev, express, ek_net, paid_total, paid_ek, paid_size, shopify_order_id')
      .in('status', BOUGHT)
    if (error) throw new Error(error.message)
    const list = data || []

    // Alte Bestellungen einmalig nachtragen (bezahlter Betrag von Shopify, sonst Angebotspreis)
    const todo = list.filter(o => o.paid_total == null || o.paid_ek == null)
    if (todo.length) {
      let totals = {}
      const ids = todo.map(o => o.shopify_order_id).filter(Boolean)
      if (ids.length) { try { totals = await shopifyOrderTotals(ids) } catch (e) { console.error('Shopify-Beträge:', e.message) } }
      for (const o of todo) {
        const upd = {
          paid_total: o.paid_total ?? (totals[String(o.shopify_order_id)] || parseFloat(o.final_price) || null),
          paid_ek: o.paid_ek ?? ekOf(o),
          paid_size: o.paid_size || (o.width && o.height ? `${o.width} × ${o.height} cm` : null),
        }
        await sb.from('offers').update(upd).eq('id', o.id)
        Object.assign(o, upd)
      }
    }

    const orders = list.map(o => {
      const revenue = parseFloat(o.paid_total) || 0, ek = parseFloat(o.paid_ek) || 0
      return {
        id: o.id, nr: o.custom_id || o.id, project: o.project || '', date: o.ordered_at || o.created_at,
        size: o.paid_size || '', revenue: r2(revenue), ek: r2(ek), profit: r2(revenue / 1.19 - ek),
        approx: !o.ek_net, express: !!o.express, bw: !!o.black_week,
      }
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)))

    const bw = await getBW(sb)
    const archive = await getSetting(sb, 'black_week_archive', [])
    const { count: bwOffers } = await sb.from('offers').select('id', { count: 'exact', head: true }).eq('black_week', true)
    return Response.json({
      orders,
      blackWeek: { on: !!bw?.on, start: bw?.started_at || null, end: bw?.end || null, pct: 30, offers: bwOffers || 0 },
      archive: Array.isArray(archive) ? archive : [],
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
