import { createClient } from '@supabase/supabase-js'
import { buildShippedEmail, buildTodayEmail, sendMail, SUBJECT_SHIPPED, SUBJECT_TODAY } from '../../../lib/shipping-emails'

// Manueller Versand der Versand- bzw. "Heute kommt"-Mail aus dem Admin (Testmodus)
// Body: { offerId, type: 'versand' | 'heute' }  – ändert keinen Status
export async function POST(req) {
  try {
    const { offerId, type } = await req.json()
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: o } = await supabase.from('offers').select('*').eq('id', offerId).maybeSingle()
    if (!o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
    if (!o.customer_email) return Response.json({ error: 'Keine E-Mail hinterlegt' }, { status: 400 })

    const today = type === 'heute'
    await sendMail(o.customer_email, today ? SUBJECT_TODAY : SUBJECT_SHIPPED, today ? buildTodayEmail(o) : buildShippedEmail(o))
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
