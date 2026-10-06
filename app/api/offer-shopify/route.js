import { createClient } from '@supabase/supabase-js'
import { syncOfferShopify } from '../../../lib/shopify-admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Admin: Verstecktes Produkt + Bestellentwurf für ein Angebot anlegen/aktualisieren
// Body: { offerId (Datenbank-ID), imageUrl (quadratisches Bild), refreshImage }
export async function POST(req) {
  try {
    const { offerId, imageUrl, refreshImage } = await req.json()
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: o } = await supabase.from('offers').select('*').eq('id', offerId).maybeSingle()
    if (!o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
    if (!(parseFloat(o.base_price) > 0)) return Response.json({ error: 'Kein Preis im Angebot' }, { status: 400 })

    const ids = await syncOfferShopify(o, { imageUrl, refreshImage })
    await supabase.from('offers').update(ids).eq('id', o.id)
    return Response.json({ success: true, checkoutUrl: ids.checkout_url })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
