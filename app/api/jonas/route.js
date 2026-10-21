import { sb, validSignature, handleWebhook, connection, reply } from '../../../lib/jonas'
import { addExample } from '../../../lib/wissen'
import { sendPush } from '../../../lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Jonas Schröder (Instagram & Facebook Messenger)
// GET ?hub.mode=subscribe...   -> Meta prüft den Webhook (META_VERIFY_TOKEN)
// POST (von Meta)              -> neue Nachricht, Entwurf schreiben
// GET  (angemeldet)            -> Zentrale: Verbindung, Statistik, offene Chats, Verlauf
// POST { action, id, text }    -> 'send' Antwort senden / 'skip' selbst antworten   (angemeldet)

const fail = (e) => Response.json({ error: e.message }, { status: e.status || 500 })
async function user(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  const { data, error } = await sb().auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  return data.user
}
const today = () => { const n = new Date(); const s = n.toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }); const off = Math.round((new Date(s.replace(' ', 'T') + 'Z') - n) / 60000) * 60000; return new Date(new Date(s.slice(0, 10) + 'T00:00:00Z') - off).toISOString() }

export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams
    if (sp.get('hub.mode') === 'subscribe') {
      if (!process.env.META_VERIFY_TOKEN || sp.get('hub.verify_token') !== process.env.META_VERIFY_TOKEN) return new Response('Falscher Token', { status: 403 })
      return new Response(sp.get('hub.challenge') || '', { status: 200, headers: { 'content-type': 'text/plain' } })
    }
    await user(req)
    const db = sb()
    const [conn, { data: open }, { data: hist }, { count: inToday }, { count: repToday }] = await Promise.all([
      connection(),
      db.from('social_threads').select('*').eq('status', 'open').order('last_in_at', { ascending: false }).limit(20),
      db.from('social_threads').select('id,channel,name,handle,action,done_at').eq('status', 'done').order('done_at', { ascending: false }).limit(30),
      db.from('social_msgs').select('id', { count: 'exact', head: true }).eq('dir', 'in').gte('at', today()),
      db.from('social_threads').select('id', { count: 'exact', head: true }).eq('action', 'replied').gte('done_at', today()),
    ])
    const ids = [...(open || []).map(t => t.id), ...(hist || []).map(t => t.id)]
    const { data: msgs } = ids.length ? await db.from('social_msgs').select('thread_id,dir,text,at').in('thread_id', ids).order('at', { ascending: false }).limit(600) : { data: [] }
    const by = {}; for (const m of msgs || []) (by[m.thread_id] ||= []).push(m)
    const lastIn = (id) => (by[id] || []).find(m => m.dir === 'in')?.text || ''
    return Response.json({
      connection: conn,
      stats: { in: inToday || 0, replied: repToday || 0, open: (open || []).length },
      open: (open || []).map(t => ({ id: t.id, channel: t.channel, name: t.name || (t.channel === 'ig' ? 'Instagram-Nutzer' : 'Facebook-Nutzer'), handle: t.handle || '', at: t.last_in_at, draft: t.draft || '', error: t.error || '', msgs: (by[t.id] || []).slice(0, 8).reverse().map(m => ({ dir: m.dir, text: m.text, at: m.at })) })),
      history: (hist || []).map(t => ({ id: t.id, channel: t.channel, name: t.name || t.handle || 'Kunde', text: lastIn(t.id), action: t.action, at: t.done_at })),
    })
  } catch (e) { return fail(e) }
}

export async function POST(req) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth) {
      // Webhook von Meta
      const raw = await req.text()
      if (!validSignature(raw, req.headers.get('x-hub-signature-256'))) return new Response('Ungültige Signatur', { status: 401 })
      let body = {}; try { body = JSON.parse(raw) } catch {}
      const out = await handleWebhook(body)
      if (out.drafts) await sendPush({ title: 'Jonas: Nachricht wartet', body: out.drafts === 1 ? 'Neue Nachricht auf Instagram oder Facebook, Entwurf ist fertig.' : `${out.drafts} neue Nachrichten, Entwürfe sind fertig.`, tag: 'jonas' }).catch(() => {})
      return new Response('EVENT_RECEIVED', { status: 200 })
    }
    await user(req)
    const { action, id, text } = await req.json()
    const db = sb()
    const { data: t } = await db.from('social_threads').select('*').eq('id', id).maybeSingle()
    if (!t) return Response.json({ error: 'Chat nicht gefunden' }, { status: 404 })
    if (t.status !== 'open') return Response.json({ error: 'Schon erledigt' }, { status: 400 })
    if (action === 'skip') {
      await db.from('social_threads').update({ status: 'done', action: 'self', done_at: new Date().toISOString() }).eq('id', id)
      return Response.json({ success: true })
    }
    if (action === 'send') {
      const body = String(text || t.draft || '').trim()
      if (!body) return Response.json({ error: 'Antwort ist leer' }, { status: 400 })
      await reply(t, body)
      await db.from('social_threads').update({ status: 'done', action: 'replied', draft: body, error: null, done_at: new Date().toISOString() }).eq('id', id)
      if (t.draft && body !== t.draft.trim()) {
        const { data: q } = await db.from('social_msgs').select('text').eq('thread_id', id).eq('dir', 'in').order('at', { ascending: false }).limit(1)
        await addExample({ question: q?.[0]?.text || '', before: t.draft, after: body }).catch(() => {})
      }
      return Response.json({ success: true })
    }
    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (e) { return fail(e) }
}
