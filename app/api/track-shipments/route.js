import { createClient } from '@supabase/supabase-js'
import { removeOfferShopify } from '../../../lib/shopify-admin'
import { buildShippedEmail, buildTodayEmail, sendMail, SUBJECT_SHIPPED, SUBJECT_TODAY } from '../../../lib/shipping-emails'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Wird stündlich von cron-job.org aufgerufen:
//   https://angebote.neonframe.de/api/track-shipments?key=DEIN_CRON_SECRET
// Fragt bei DHL den Status aller versendeten Schilder ab:
//   "in Zustellung" -> Mail "Heute kommt dein Schild"   |   "zugestellt" -> Status "Zugestellt"
//
// Test (schickt die Mail an die Kunden-E-Mail des Angebots, ohne Status zu ändern):
//   ...?key=DEIN_CRON_SECRET&test=ANGEBOTS-ID&mail=versand   oder   &mail=heute

const OUT_FOR_DELIVERY = /out for delivery|with delivery courier|with the courier|loaded onto the delivery vehicle|in zustellung|zustellfahrzeug|wird heute zugestellt|voraussichtlich heute|bezorger|onderweg naar/i

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  if (!process.env.CRON_SECRET || searchParams.get('key') !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Nicht erlaubt' }, { status: 401 })
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // ---- Testversand ----
  const testId = searchParams.get('test')
  if (testId) {
    const { data: o } = await supabase.from('offers').select('*').eq('id', testId).maybeSingle()
    if (!o?.customer_email) return Response.json({ error: 'Angebot oder E-Mail nicht gefunden' }, { status: 404 })
    const today = searchParams.get('mail') === 'heute'
    await sendMail(o.customer_email, today ? SUBJECT_TODAY : SUBJECT_SHIPPED, today ? buildTodayEmail(o) : buildShippedEmail(o))
    return Response.json({ success: true, test: today ? 'heute' : 'versand', to: o.customer_email })
  }

  // ---- Shopify aufräumen: Angebots-Produkte von beendeten Angeboten entfernen ----
  const cleaned = []
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data: done } = await supabase.from('offers').select('id, status, valid_until, shopify_product_id, shopify_draft_id').not('shopify_product_id', 'is', null)
    for (const o of done || []) {
      const open = ['offer_sent', 'recontacted', 'discount_offered', 'discount_reminded'].includes(o.status)
      const expired = open && o.valid_until && o.valid_until < today
      if (o.status === 'unsubscribed' || expired || o.status === 'delivered') {
        await removeOfferShopify(o)
        await supabase.from('offers').update({ shopify_product_id: null, shopify_variant_id: null, ...(o.status === 'delivered' ? {} : { shopify_draft_id: null }) }).eq('id', o.id)
        cleaned.push(o.id)
      }
    }
  } catch (e) { cleaned.push('Fehler: ' + e.message) }

  // Nur tagsüber prüfen (spart DHL-Abfragen)
  const hour = Number(new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hour12: false, timeZone: 'Europe/Berlin' }).format(new Date()))
  if (hour < 5 || hour > 21) return Response.json({ skipped: 'Nachtruhe', cleaned })

  if (!process.env.DHL_API_KEY) return Response.json({ error: 'DHL_API_KEY fehlt' }, { status: 500 })

  const { data: list } = await supabase.from('offers').select('*').eq('status', 'shipped').not('tracking_number', 'is', null)
  const results = []

  for (const o of list || []) {
    // Nur DHL-Sendungen (andere Paketdienste bekommen nur die Versand-Mail)
    if (o.tracking_company && !/dhl/i.test(o.tracking_company)) { results.push({ id: o.id, skipped: o.tracking_company }); continue }
    try {
      const r = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(o.tracking_number)}&language=de`, {
        headers: { 'DHL-API-Key': process.env.DHL_API_KEY, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!r.ok) { results.push({ id: o.id, dhl: r.status }); continue }
      const s = (await r.json()).shipments?.[0]
      const code = s?.status?.statusCode || ''
      const text = [s?.status?.status, s?.status?.description, ...(s?.events || []).slice(0, 2).map(e => `${e.status || ''} ${e.description || ''}`)].join(' ')

      if (code === 'delivered') {
        await supabase.from('offers').update({ status: 'delivered', delivered_at: s.status.timestamp || new Date().toISOString() }).eq('id', o.id)
        results.push({ id: o.id, status: 'delivered' })
      } else if (!o.today_email_sent_at && OUT_FOR_DELIVERY.test(text)) {
        if (o.customer_email) await sendMail(o.customer_email, SUBJECT_TODAY, buildTodayEmail(o))
        await supabase.from('offers').update({ today_email_sent_at: new Date().toISOString() }).eq('id', o.id)
        results.push({ id: o.id, status: 'in Zustellung – Mail gesendet' })
      } else {
        results.push({ id: o.id, status: code || 'unbekannt' })
      }
    } catch (e) {
      results.push({ id: o.id, error: e.message })
    }
    await new Promise(res => setTimeout(res, 5500)) // DHL erlaubt max. 1 Abfrage pro 5 Sek.
  }

  return Response.json({ checked: results.length, results, cleaned })
}
