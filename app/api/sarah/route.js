import { sb, run, undo, reply } from '../../../lib/sarah'
import { sendPush } from '../../../lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Sarah Krüger (Kundenservice, Posteingang)
// GET ?run=1&key=...            -> Posteingang prüfen (cron-job.org alle 5 Min.)
// GET                           -> Zentrale: Verbindung, Statistik, Entwürfe, Verlauf   (angemeldet)
// POST { action, id, text }     -> 'send' Antwort senden / 'skip' selbst antworten / 'undo' zurück in den Posteingang (angemeldet)

const fail = (e) => Response.json({ error: e.message }, { status: e.status || 500 })
async function user(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  const { data, error } = await sb().auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  return data.user
}
// Heute 0:00 Uhr deutscher Zeit (Sommer- und Winterzeit)
const today = () => { const n = new Date(); const s = n.toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }); const off = Math.round((new Date(s.replace(' ', 'T') + 'Z') - n) / 60000) * 60000; return new Date(new Date(s.slice(0, 10) + 'T00:00:00Z') - off).toISOString() }

async function saveRun(info) {
  const db = sb()
  const { data: ex } = await db.from('agent_tasks').select('id').eq('type', 'sarah_run').limit(1)
  const row = { type: 'sarah_run', tnc_id: 'sarah', status: 'log', email: JSON.stringify(info).slice(0, 900), done_at: new Date().toISOString() }
  if (ex?.[0]) await db.from('agent_tasks').update(row).eq('id', ex[0].id)
  else await db.from('agent_tasks').insert([row])
}

export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams
    if (sp.get('run')) {
      if (!process.env.FOLLOWUP_KEY || sp.get('key') !== process.env.FOLLOWUP_KEY) return Response.json({ error: 'Falscher Schlüssel' }, { status: 401 })
      let out
      try { out = await run(); await saveRun({ ok: true, ...out }) }
      catch (e) { await saveRun({ ok: false, error: e.message }); throw e }
      if (out.drafts) await sendPush({ title: out.drafts === 1 ? 'Sarah: Antwort wartet' : `Sarah: ${out.drafts} Antworten warten`, body: 'Kundenfrage im Posteingang, Entwurf ist fertig. Tippen zum Freigeben.', tag: 'sarah' }).catch(() => {})
      return Response.json({ success: true, ...out })
    }
    await user(req)
    const db = sb()
    const [{ data: open }, { data: hist }, { data: day }, { data: st }] = await Promise.all([
      db.from('inbox').select('*').eq('status', 'open').order('received_at', { ascending: false }).limit(30),
      db.from('inbox').select('id,from_name,from_email,subject,kind,action,folder,error,done_at,status').in('action', ['moved', 'undone']).order('done_at', { ascending: false }).limit(300),
      db.from('inbox').select('kind,action').gte('created_at', today()),
      db.from('agent_tasks').select('email,done_at').eq('type', 'sarah_run').limit(1),
    ])
    const c = (fn) => (day || []).filter(fn).length
    let last = {}; try { last = JSON.parse(st?.[0]?.email || '{}') } catch {}
    return Response.json({
      connection: { ok: st?.[0] ? last.ok !== false : null, at: st?.[0]?.done_at || null, error: last.error || '' },
      stats: { trash: c(r => r.action === 'moved' && (r.kind === 'spam' || r.kind === 'werbung')), personal: c(r => r.action === 'moved' && r.kind === 'persoenlich'), invoices: c(r => r.action === 'moved' && r.kind === 'rechnung'), protected: c(r => r.kind === 'geschuetzt') },
      open: (open || []).map(r => ({ id: r.id, name: r.from_name || r.from_email, email: r.from_email, subject: r.subject, at: r.received_at, text: (r.body || '').slice(0, 3000), draft: r.draft || '' })),
      history: (hist || []).map(r => ({ id: r.id, name: r.from_name || r.from_email, subject: r.subject, kind: r.kind, folder: r.folder, undone: r.action === 'undone', at: r.done_at })),
      today: (hist || []).filter(r => r.done_at >= today()).length,
    })
  } catch (e) { return fail(e) }
}

export async function POST(req) {
  try {
    await user(req)
    const { action, id, text } = await req.json()
    const db = sb()
    const { data: r } = await db.from('inbox').select('*').eq('id', id).maybeSingle()
    if (!r) return Response.json({ error: 'Mail nicht gefunden' }, { status: 404 })
    if (action === 'undo') {
      if (r.action !== 'moved') return Response.json({ error: 'Diese Mail wurde nicht verschoben' }, { status: 400 })
      await undo(r)
      await db.from('inbox').update({ action: 'undone' }).eq('id', id)
      return Response.json({ success: true })
    }
    if (r.status !== 'open') return Response.json({ error: 'Schon erledigt' }, { status: 400 })
    if (action === 'skip') {
      await db.from('inbox').update({ status: 'done', action: 'self', done_at: new Date().toISOString() }).eq('id', id)
      return Response.json({ success: true })
    }
    if (action === 'send') {
      const body = String(text || r.draft || '').trim()
      if (!body) return Response.json({ error: 'Antwort ist leer' }, { status: 400 })
      await reply(r, body)
      await db.from('inbox').update({ status: 'done', action: 'replied', draft: body, done_at: new Date().toISOString() }).eq('id', id)
      return Response.json({ success: true })
    }
    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (e) { return fail(e) }
}
