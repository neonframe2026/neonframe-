import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Shopify-Webhook "Entwurfsbestellungs-Aktualisierung" (draft_orders/update)
// Wenn ein Entwurf bezahlt/abgeschlossen wird -> passendes Angebot auf "Bestellt" setzen
export async function POST(request) {
  try {
    const raw = await request.text()

    // Echtheit prüfen (Signatur von Shopify)
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET
    const hmac = request.headers.get('x-shopify-hmac-sha256') || ''
    if (!secret) return Response.json({ error: 'SHOPIFY_WEBHOOK_SECRET fehlt' }, { status: 500 })
    const digest = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64')
    const ok = hmac.length === digest.length && crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest))
    if (!ok) return Response.json({ error: 'Ungültige Signatur' }, { status: 401 })

    const draft = JSON.parse(raw)
    if (draft.status !== 'completed') return Response.json({ skipped: 'Entwurf noch nicht abgeschlossen' })

    // Token aus dem Checkout-Link, z.B. .../invoices/abc123 -> abc123
    const token = String(draft.invoice_url || '').split('/invoices/')[1]?.split(/[/?#]/)[0]
    if (!token) return Response.json({ skipped: 'Kein Checkout-Link im Entwurf' })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data, error } = await supabase
      .from('offers')
      .update({ status: 'confirmed' })
      .ilike('checkout_url', `%${token}%`)
      .select('id')

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, updated: data?.length || 0 })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
