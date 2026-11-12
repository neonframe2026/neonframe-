import { createClient } from '@supabase/supabase-js'
import { toBlackWeek, fromBlackWeek, getBW } from '../../../lib/blackweek'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SITE = 'https://angebote.neonframe.de'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))

// Einzelnes Angebot auf Black Week umstellen bzw. zurück
// POST { id, on: true | false, mail: true | false }
export async function POST(req) {
  try {
    const { id, on, mail } = await req.json()
    const sb = db()
    const { data: o, error } = await sb.from('offers').select('*').eq('id', id).single()
    if (error || !o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
    if (!(await getBW(sb)).active) return Response.json({ error: 'Black Week ist in den Einstellungen nicht aktiv' }, { status: 400 })
    const next = on ? await toBlackWeek(sb, o) : await fromBlackWeek(sb, o)
    let mailSent = false, mailError = null
    if (on && mail && o.customer_email && !o.unsubscribed && o.status !== 'unsubscribed') {
      try {
        const r = await fetch(`${SITE}/api/bw-mail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerId: o.id, kind: 'switch' }) })
        const j = await r.json().catch(() => ({}))
        if (!j.success) throw new Error(j.error || 'Mail fehlgeschlagen')
        mailSent = true
      } catch (e) { mailError = e.message }
    }
    return Response.json({ success: true, offer: next, mailSent, mailError })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
