import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Kunde wählt auf der Angebotsseite Variante 1 oder 2 -> Auswahl speichern
// Body: { offerId, sel: 1 | 2 }
export async function POST(req) {
  try {
    const { offerId, sel } = await req.json()
    const n = Number(sel)
    if (!offerId || ![1, 2].includes(n)) return Response.json({ error: 'Ungültige Auswahl' }, { status: 400 })
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
    const { data: o } = await db.from('offers').select('id, neon_variants').eq('id', offerId).maybeSingle()
    if (!o?.neon_variants || o.neon_variants.v2 == null) return Response.json({ error: 'Keine Varianten' }, { status: 400 })
    const { error } = await db.from('offers').update({ variant_sel: n }).eq('id', o.id)
    if (error) throw new Error(error.message)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
