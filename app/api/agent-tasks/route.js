import { createClient } from '@supabase/supabase-js'
import { sendPush } from '../../../lib/push'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Aufgaben der KI-Agenten ("Wartet auf Freigabe")
// POST  { type: 'offer' | 'update', tnc_id, project, email }  -> kommt von Make
// GET                                                        -> offene Aufgaben für die Zentrale
// PATCH ?id=...  { status: 'done' }                          -> Aufgabe von Hand erledigen
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function POST(req) {
  try {
    const b = await req.json()
    const type = b.type === 'update' ? 'update' : 'offer'
    const tnc_id = String(b.tnc_id || '').match(/\d{8,}/)?.[0]
    if (!tnc_id) return Response.json({ error: 'tnc_id fehlt' }, { status: 400 })
    const row = { type, tnc_id, project: (b.project || '').trim() || null, email: (b.email || '').trim() || null, status: 'open' }
    // Gleiche offene Aufgabe nicht doppelt anlegen
    const { data: ex } = await db().from('agent_tasks').select('id').eq('type', type).eq('tnc_id', tnc_id).eq('status', 'open').limit(1)
    const q = ex?.[0] ? db().from('agent_tasks').update(row).eq('id', ex[0].id) : db().from('agent_tasks').insert([row])
    const { error } = await q
    if (error) throw new Error(error.message)
    // Neue Aufgabe -> Push aufs Handy
    if (!ex?.[0]) await sendPush(type === 'update'
      ? { title: 'Tom: Änderung von Kenzo', body: `Angebot ${tnc_id} wurde geändert. Vorher/Nachher ansehen.`, tag: 'update-' + tnc_id }
      : { title: 'Lisa: Neues Angebot wartet', body: `${row.project || 'Ohne Projekt'} · TNC ${tnc_id} ist fertig. Tippen zum Freigeben.`, tag: 'offer-' + tnc_id }
    ).catch(() => {})
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data: tasks, error } = await db().from('agent_tasks').select('*').eq('status', 'open').in('type', ['offer', 'update']).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    // Neues Angebot schon veröffentlicht? Dann automatisch erledigt
    const open = []
    for (const t of tasks || []) {
      if (t.type === 'offer') {
        const { data: o } = await db().from('offers').select('id').eq('offer_num', t.tnc_id).gte('created_at', t.created_at).limit(1)
        if (o?.length) { await db().from('agent_tasks').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', t.id); continue }
      }
      open.push(t)
    }
    return Response.json(open)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    const { error } = await db().from('agent_tasks').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id)
    if (error) throw new Error(error.message)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
