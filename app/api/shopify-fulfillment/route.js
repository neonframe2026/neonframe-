import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { buildShippedEmail, sendMail, SUBJECT_SHIPPED } from '../../../lib/shipping-emails'

// Shopify-Webhook "Auftragsabwicklung erstellt" (fulfillments/create)
// Sendungsnummer eingetragen -> Status "Versendet" + Versand-Mail mit Tracking-Link
export async function POST(request) {
  try {
    const raw = await request.text()

    const secret = process.env.SHOPIFY_WEBHOOK_SECRET
    const hmac = request.headers.get('x-shopify-hmac-sha256') || ''
    if (!secret) return Response.json({ error: 'SHOPIFY_WEBHOOK_SECRET fehlt' }, { status: 500 })
    const digest = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64')
    const ok = hmac.length === digest.length && crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest))
    if (!ok) return Response.json({ error: 'Ungültige Signatur' }, { status: 401 })

    const f = JSON.parse(raw)
    const trackingNumber = f.tracking_number || f.tracking_numbers?.[0] || ''
    if (!trackingNumber) return Response.json({ skipped: 'Keine Sendungsnummer' })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

    // Angebot finden: über die Shopify-Bestellnummer, sonst über die E-Mail des Kunden
    let { data: o } = await supabase.from('offers').select('*').eq('shopify_order_id', String(f.order_id)).maybeSingle()
    if (!o && f.email) {
      const { data } = await supabase.from('offers').select('*')
        .ilike('customer_email', f.email).in('status', ['confirmed', 'in_production'])
        .order('created_at', { ascending: false }).limit(1)
      o = data?.[0] || null
    }
    if (!o) return Response.json({ skipped: 'Kein passendes Angebot gefunden', order_id: f.order_id })

    const update = {
      status: 'shipped',
      tracking_number: trackingNumber,
      tracking_url: f.tracking_url || f.tracking_urls?.[0] || null,
      tracking_company: f.tracking_company || null,
      shipped_at: new Date().toISOString(),
    }
    const alreadySent = o.shipped_at && o.tracking_number === trackingNumber
    await supabase.from('offers').update(update).eq('id', o.id)

    // Mail nur einmal pro Sendungsnummer (Shopify schickt Webhooks manchmal doppelt)
    if (!alreadySent && o.customer_email && process.env.RESEND_API_KEY) {
      await sendMail(o.customer_email, SUBJECT_SHIPPED, buildShippedEmail({ ...o, ...update }))
    }

    return Response.json({ success: true, offer: o.id, mail: !alreadySent })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
