// Bestellung verfolgen: Formular auf neonframe.de/pages/bestellung-verfolgen schickt Nummer + E-Mail hierher
// Passt beides zusammen -> Weiterleitung auf die Bestellstatus-Seite, sonst zurück mit Fehlermeldung
// Nummer darf sein: lange Nummer (12094754737), kurze Nummer (2480) oder Shopify-Bestellnummer (#1234)
import { createClient } from '@supabase/supabase-js'
import { shopifyOrderNames } from '../../../lib/shopify-admin'

export const dynamic = 'force-dynamic'

const SITE = 'https://angebote.neonframe.de'
const BACK = 'https://neonframe.de/pages/bestellung-verfolgen'

export async function GET() {
  return Response.redirect(BACK, 303)
}

export async function POST(req) {
  const fail = () => Response.redirect(`${BACK}?fehler=1`, 303)
  try {
    const f = await req.formData()
    const nr = String(f.get('nr') || '').replace(/\D/g, '')
    const email = String(f.get('email') || '').trim().toLowerCase()
    if (!nr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail()

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data } = await db.from('offers')
      .select('id, offer_num, custom_id, shopify_order_id, created_at')
      .ilike('customer_email', email.replace(/[%_\\]/g, '\\$&'))
      .order('created_at', { ascending: false })
      .limit(50)
    const list = data || []

    // 1) lange oder kurze Nummer
    let o = list.find(x => String(x.offer_num || '') === nr || String(x.custom_id || '') === nr)

    // 2) Shopify-Bestellnummer (#1234) direkt bei Shopify nachschlagen
    if (!o) {
      const ids = [...new Set(list.map(x => x.shopify_order_id).filter(Boolean).map(String))]
      if (ids.length) {
        try {
          const names = await shopifyOrderNames(ids)
          o = list.find(x => x.shopify_order_id && String(names[String(x.shopify_order_id)] || '').replace(/\D/g, '') === nr)
        } catch {}
      }
    }

    if (!o) return fail()
    // Status-Seite zeigt bei noch nicht bestellten Angeboten automatisch das Angebot
    return Response.redirect(o.offer_num ? `${SITE}/status/${o.offer_num}` : `${SITE}/angebot/${o.custom_id || o.id}`, 303)
  } catch {
    return fail()
  }
}
