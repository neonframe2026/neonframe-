import { createClient } from '@supabase/supabase-js'
import { syncOfferShopify } from '../../../lib/shopify-admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Kunde wählt auf der Angebotsseite eine andere Größe:
// Preis + Maße im Angebot, im Shopify-Produkt und im vorhandenen Bestellentwurf ändern
// Body: { offerId, width }
export async function POST(req) {
  try {
    const { offerId, width } = await req.json()
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: o } = await supabase.from('offers').select('*').eq('id', offerId).maybeSingle()
    if (!o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })

    const w = Number(width)
    const W0 = parseFloat(o.width) || 0
    if (w === W0 && o.checkout_url) return Response.json({ checkoutUrl: o.checkout_url })

    const rows = Array.isArray(o.size_options) ? o.size_options.filter(r => +r.w > 0 && +r.h > 0 && +r.vk > 0) : []
    const row = rows.find(r => +r.w === w)
    if (!row) return Response.json({ error: 'Ungültige Größe' }, { status: 400 })

    // Gesamtbetrag = Empf. VK + 10 % -> Listenpreis (netto, vor Rabatt) zurückrechnen
    const dType = o.disc_type || 'pct'
    const dVal = parseFloat(o.disc_val) || 0
    const vat = 1 + (parseFloat(o.vat_pct) || 19) / 100
    const ex = (parseFloat(o.extra_disc_pct) || 0) / 100
    const target = +row.vk * 1.10 // Gesamtbetrag ohne Extra-Rabatt = Empf. VK + 10 %
    const base = Math.round((dType === 'pct' ? target / vat / (1 - dVal / 100) : target / vat + dVal) * 10000) / 10000
    const net = (dType === 'pct' ? base * (1 - dVal / 100) : Math.max(0, base - dVal)) * (1 - ex)
    const final = Math.round(net * vat * 100) / 100

    // Originalgröße als Zeile behalten, damit der Kunde zurückwechseln kann
    const newRows = rows.filter(r => +r.w !== w)
    const b0 = parseFloat(o.base_price) || 0
    const vkOrig = Math.round(((dType === 'pct' ? b0 * (1 - dVal / 100) : Math.max(0, b0 - dVal)) * vat / 1.10) * 100) / 100
    if (W0 && vkOrig > 0 && !newRows.some(r => +r.w === W0)) newRows.push({ w: W0, h: parseFloat(o.height) || 0, vk: vkOrig })

    const updated = {
      width: w, height: +row.h, base_price: base,
      net_price: Math.round(net * 100) / 100, final_price: final, size_options: newRows,
    }
    const ids = await syncOfferShopify({ ...o, ...updated })
    await supabase.from('offers').update({ ...updated, ...ids }).eq('id', o.id)
    return Response.json({ checkoutUrl: ids.checkout_url })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
