import { createClient } from '@supabase/supabase-js'
import { createDraftOrder } from '../../../lib/shopify-admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Kunde wählt auf der Angebotsseite eine andere Größe -> neuer Preis, neuer Shopify-Entwurf, Checkout-Link zurück
// Body: { offerId, width }
export async function POST(req) {
  try {
    const { offerId, width } = await req.json()
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: o } = await supabase.from('offers').select('*').eq('id', offerId).maybeSingle()
    if (!o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })

    const W0 = parseFloat(o.width) || 0
    const H0 = parseFloat(o.height) || 0
    const minW = parseFloat(o.size_min_width) || 0
    const pMin = parseFloat(o.tnc_price_min) || 0
    const pMax = parseFloat(o.tnc_price_max) || 0
    if (!(W0 > 0 && H0 > 0 && minW > 0 && minW < 300 && pMin > 0 && pMax > 0)) {
      return Response.json({ error: 'Größenwahl für dieses Angebot nicht aktiv' }, { status: 400 })
    }

    const w = Number(width)
    const valid = w === W0 || (w >= 30 && w <= 300 && w % 10 === 0)
    if (!valid || w < minW) return Response.json({ error: 'Ungültige Größe' }, { status: 400 })
    if (w === W0 && o.checkout_url) return Response.json({ checkoutUrl: o.checkout_url })

    // gleiche Formel wie auf der Angebotsseite
    const partner = (x) => pMin + (pMax - pMin) * (x - minW) / (300 - minW)
    const base = Math.round((parseFloat(o.base_price) || 0) * partner(w) / partner(W0) * 100) / 100
    const h = Math.round(w * H0 / W0)
    const discType = o.disc_type || 'pct'
    const discVal = parseFloat(o.disc_val) || 0
    const vatPct = parseFloat(o.vat_pct) || 19
    const net = discType === 'pct' ? base * (1 - discVal / 100) : Math.max(0, base - discVal)
    const final = Math.round(net * (1 + vatPct / 100) * 100) / 100

    const draft = await createDraftOrder({
      email: o.customer_email || null,
      title: `Individuelles LED-Neon-Schild – ${o.project || ''}`.trim(),
      listNet: base, discType, discVal, vatPct,
      note: `Angebot ${o.offer_num || o.id} – Größe vom Kunden geändert: ${W0} → ${w} cm`,
      attributes: [
        { key: 'Angebot', value: String(o.offer_num || o.id) },
        { key: 'Größe', value: `${w} × ${h} cm` },
        { key: 'Farbe(n)', value: o.colors || '' },
        { key: 'Rückwand', value: [o.backplate, o.backplate_color].filter(Boolean).join(' / ') },
        { key: 'Verwendung', value: o.usage || '' },
      ],
    })
    if (!draft?.invoiceUrl) throw new Error('Kein Checkout-Link von Shopify')

    await supabase.from('offers').update({
      width: w, height: h, base_price: base,
      net_price: Math.round(net * 100) / 100, final_price: final,
      checkout_url: draft.invoiceUrl,
    }).eq('id', o.id)

    return Response.json({ checkoutUrl: draft.invoiceUrl })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
