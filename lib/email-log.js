import { createClient } from '@supabase/supabase-js'

// Speichert jede verschickte Kunden-Mail (Tabelle "email_log"), damit man sie im Admin unter "Verlauf" anschauen kann.
// Fehler hier dürfen den Versand nie blockieren.
// Typen: angebot, erinnerung, rabatt, rabatt_erinnerung, produktion, versand, heute, bewertung
export async function logEmail(offerId, type, subject, html, recipient) {
  try {
    if (!offerId || !html) return
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ||    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
    const { error } = await supabase.from('email_log').insert({ offer_id: offerId, type, subject: subject || null, recipient: recipient || null, html })
    if (error) console.error('email_log:', error.message)
  } catch (e) {
    console.error('email_log:', e)
  }
}
