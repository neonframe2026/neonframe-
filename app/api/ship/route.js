import { createClient } from '@supabase/supabase-js'
import { buildShippedEmail, sendMail, SUBJECT_SHIPPED } from '../../../lib/shipping-emails'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Sendungsnummer aus dem Admin (Bearbeiten) -> Status "Versendet" + Versand-Mail
// Body: { offerId, trackingNumber, trackingCompany }
export async function POST(req) {
  try {
    const { offerId, trackingNumber, trackingCompany } = await req.json()
    const tn = String(trackingNumber || '').trim()
    if (!offerId || !tn) return Response.json({ error: 'Sendungsnummer fehlt' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: o } = await supabase.from('offers').select('*').eq('id', offerId).maybeSingle()
    if (!o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
    if (!o.customer_email) return Response.json({ error: 'Keine E-Mail hinterlegt' }, { status: 400 })

    // Schon mit dieser Nummer verschickt (z. B. über Shopify)? Dann keine zweite Mail.
    if (o.shipped_at && o.tracking_number === tn) return Response.json({ success: true, skipped: 'Versand-Mail wurde schon gesendet' })

    const update = {
      status: 'shipped',
      tracking_number: tn,
      tracking_company: trackingCompany || 'DHL',
      tracking_url: null,
      shipped_at: new Date().toISOString(),
      today_email_sent_at: null,
    }
    await sendMail(o.customer_email, SUBJECT_SHIPPED, buildShippedEmail({ ...o, ...update }))
    const { error } = await supabase.from('offers').update(update).eq('id', o.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
