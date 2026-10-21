import { createClient } from '@supabase/supabase-js'
import { sendPush } from '../../../lib/push'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Follow-up-Agent (Emma)
// GET                      -> Übersicht für die Zentrale: { approve, next, sent }
// GET ?run=1&key=...       -> Automatik (cron-job.org alle 10 Min.): schickt fällige Mails, nur 8:10 bis 20:00 Uhr
// POST { action: 'send' | 'skip', id }   -> Freigabe aus der Zentrale (id = "<offerId>:<art>")
//
// Automatisch: Erinnerung (12 Std. nach Angebot), Rabatt-Erinnerung (3 Tage nach Rabatt), Bewertung (3 Tage nach Zustellung)
// Nur mit Freigabe: Rabatt-Mail (12 Std. nach Erinnerung)
// Was vor dem Start der Automatik schon fällig war, wird nicht automatisch geschickt, sondern liegt zur Freigabe bei Emma.

const SITE = 'https://angebote.neonframe.de'
const START = new Date('2026-10-17T18:00:00Z').getTime() // Start der Automatik (17.10.2026, 20:00 Uhr)
const MAX_OLD_DAYS = 14 // ältere liegengebliebene Angebote gar nicht mehr anzeigen
const BOUGHT = ['confirmed', 'in_production', 'shipped', 'delivered']
const H = 3600000
const KIND = { erinnerung: 'Erinnerung', rabatt: 'Rabatt-Mail', rabatt_erinnerung: 'Rabatt-Erinnerung', bewertung: 'Bewertung' }

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
const t = (d) => (d ? new Date(d).getTime() : 0)

// ---------- Uhrzeit Deutschland ----------
function berlin(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  const y = +p.year, m = +p.month, d = +p.day, h = +p.hour % 24, mi = +p.minute
  const offset = Date.UTC(y, m - 1, d, h, mi) - Math.floor(ms / 60000) * 60000
  return { y, m, d, mins: h * 60 + mi, offset }
}
const FROM = 8 * 60 + 10, TO = 20 * 60 // 8:10 bis 20:00 Uhr
const inWindow = (ms) => { const b = berlin(ms); return b.mins >= FROM && b.mins < TO }
// Wann darf die Mail raus? Nachts fällig -> nächster Morgen 8:10
function sendAt(due) {
  const b = berlin(due)
  if (b.mins >= FROM && b.mins < TO) return due
  const at = Date.UTC(b.y, b.m - 1, b.d, 8, 10) - b.offset
  return b.mins < FROM ? at : at + 24 * H
}
function when(ms) {
  const b = berlin(ms), n = berlin(Date.now())
  const hm = `${Math.floor(b.mins / 60)}:${String(b.mins % 60).padStart(2, '0')}`
  const day = Date.UTC(b.y, b.m - 1, b.d), today = Date.UTC(n.y, n.m - 1, n.d)
  if (day === today) return 'heute ' + hm
  if (day === today + 24 * H) return 'morgen ' + hm
  if (day === today - 24 * H) return 'gestern ' + hm
  return `${String(b.d).padStart(2, '0')}.${String(b.m).padStart(2, '0')}. ${hm}`
}

// ---------- Was ist bei welchem Angebot dran? ----------
function step(o) {
  if (!o.customer_email || o.status === 'unsubscribed' || o.unsubscribed) return null
  if (BOUGHT.includes(o.status)) {
    if (o.review_email_sent_at) return null
    const ordered = o.order_email_sent_at ? t(o.order_email_sent_at) - 15 * 60000 : 0
    const due = o.delivered_at ? t(o.delivered_at) + 72 * H : ordered ? ordered + 240 * H : 0
    return due ? { kind: 'bewertung', due } : null
  }
  if (o.status === 'offer_sent') return { kind: 'erinnerung', due: t(o.created_at) + 12 * H }
  if (o.status === 'recontacted' && !o.extra_discount_applied) {
    const rec = o.recontacted_at ? t(o.recontacted_at) : t(o.created_at) + 12 * H
    return { kind: 'rabatt', due: rec + 12 * H }
  }
  if (o.status === 'discount_offered' && o.extra_discount_at && !o.discount_reminder_sent_at) {
    if (o.discount_valid_until && t(o.discount_valid_until) <= Date.now()) return null
    return { kind: 'rabatt_erinnerung', due: t(o.extra_discount_at) + 72 * H }
  }
  return null
}

async function load() {
  const sb = db()
  const { data: offers, error } = await sb.from('offers').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const { data: logs } = await sb.from('agent_tasks').select('*').in('type', ['fu_sent', 'fu_skip']).order('created_at', { ascending: false }).limit(300)
  const skipped = new Set((logs || []).filter(l => l.type === 'fu_skip').map(l => l.tnc_id))
  // Von dir freigegeben, aber nachts geklickt -> geht automatisch am nächsten Morgen um 8:10 raus
  const { data: sch } = await sb.from('agent_tasks').select('*').eq('type', 'fu_sched').eq('status', 'open')
  const planned = new Map((sch || []).map(x => [x.tnc_id, x]))
  // Von dir selbst geplant (Datum + Uhrzeit, steht in done_at) -> geht genau dann raus, auch außerhalb 8:10 bis 20:00
  const { data: pl } = await sb.from('agent_tasks').select('*').eq('type', 'fu_plan').eq('status', 'open')
  const custom = new Map((pl || []).map(x => [x.tnc_id, t(x.done_at)]))
  const now = Date.now()
  const items = []
  for (const o of offers || []) {
    const s = step(o)
    if (!s) continue
    const id = `${o.id}:${s.kind}`
    if (skipped.has(id)) continue
    if (s.due < now - MAX_OLD_DAYS * 24 * H) continue
    if (custom.has(id)) { items.push({ o, id, ...s, manual: false, custom: true, at: custom.get(id) }); continue }
    const p = planned.get(id)
    if (p) { items.push({ o, id, ...s, manual: false, approved: true, at: sendAt(t(p.created_at)) }); continue }
    const manual = s.due < START
    items.push({ o, id, ...s, manual, at: sendAt(Math.max(s.due, START)) })
  }
  return { items, logs: (logs || []).filter(l => l.type === 'fu_sent') }
}

// ---------- Mail schicken (nutzt die bestehenden Mail-Routen) ----------
async function send(o, kind) {
  const offerLink = `${SITE}/angebot/${o.custom_id || o.id}`
  const post = async (path, body) => {
    const r = await fetch(`${SITE}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (!j.success) throw new Error(j.error || `${path} fehlgeschlagen`)
  }
  if (kind === 'erinnerung') {
    await post('recontact', { offerId: o.id, customerEmail: o.customer_email, customerName: o.project, offerLink, price: o.final_price, width: o.width, height: o.height, colors: o.colors })
    await db().from('offers').update({ recontacted_at: new Date().toISOString() }).eq('id', o.id)
  } else if (kind === 'rabatt') {
    await post('discount', { offerId: o.id, customerEmail: o.customer_email, customerName: o.project, offerLink })
  } else if (kind === 'rabatt_erinnerung') {
    await post('discount-reminder', { offerId: o.id, offerLink })
  } else if (kind === 'bewertung') {
    await post('review-request', { customerEmail: o.customer_email, customerName: o.project, offerId: o.id })
    await db().from('offers').update({ review_email_sent_at: new Date().toISOString() }).eq('id', o.id)
  }
  await db().from('agent_tasks').update({ status: 'done', done_at: new Date().toISOString() }).in('type', ['fu_sched', 'fu_plan']).eq('tnc_id', `${o.id}:${kind}`).eq('status', 'open')
  await db().from('agent_tasks').insert([{ type: 'fu_sent', tnc_id: `${o.id}:${kind}`, project: o.project || '', email: KIND[kind], status: 'log', done_at: new Date().toISOString() }])
}

// Letzte Mail, die der Kunde von uns bekommen hat
function lastMail(o) {
  const c = [['Angebot', o.created_at], ['Erinnerung', o.recontacted_at], ['Rabatt-Mail', o.extra_discount_at], ['Rabatt-Erinnerung', o.discount_reminder_sent_at]]
    .filter(([, d]) => d).sort((a, b) => t(b[1]) - t(a[1]))[0]
  return c ? `${c[0]} ${when(t(c[1]))}` : ''
}
const nr = (o) => String(o.offer_num || o.custom_id || String(o.id).slice(0, 8))

// ---------- WhatsApp (nur Kunden, die im Konfigurator WhatsApp angehakt haben) ----------
// Telefonnummer + Haken kommen aus Annas Anfragen (Tabelle einkauf), Zuordnung über die E-Mail
const WA_KIND = { angebot: 'Angebot ist da', rabatt: 'Rabatt', rabatt_erinnerung: 'Rabatt-Erinnerung' }
const waYes = (v) => { const s = String(v ?? '').trim().toLowerCase(); return !!s && !/^(nein|no|false|0|off|aus)$/.test(s) }
function waNum(p) {
  let d = String(p || '').replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '49' + d.slice(1)
  return d.length >= 10 ? d : ''
}
function waText(o, kind) {
  const first = String(o.project || '').trim().split(/\s+/)[0]
  const link = `${SITE}/angebot/${o.custom_id || o.id}`
  const hi = first ? `Hallo ${first},` : 'Hallo,'
  const end = 'Bei weiteren Fragen stehen wir dir jederzeit gerne zur Verfügung.\n\nViele Grüße\nDein NeonFrame-Team'
  if (kind === 'angebot') return `${hi}\n\ndein Angebot für dein Neonschild ist fertig! Hier kannst du es dir ansehen: ${link}\n\n${end}`
  if (kind === 'rabatt') return `${hi}\n\ngute Nachrichten: Du bekommst jetzt zusätzlich 10% Rabatt auf dein Angebot. Das Extra gilt nur für kurze Zeit: ${link}\n\n${end}`
  const until = o.discount_valid_until ? new Date(o.discount_valid_until).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' }) : ''
  return `${hi}\n\nkurze Erinnerung: Dein Extra-Rabatt läuft bald ab${until ? ` (gültig bis ${until})` : ''}. Hier geht's zu deinem Angebot: ${link}\n\n${end}`
}
async function waList() {
  const sb = db()
  const { data: ek } = await sb.from('einkauf').select('email,phone,data,created_at').order('created_at', { ascending: false }).limit(500)
  const people = new Map()
  for (const r of ek || []) { const e = String(r.email || '').trim().toLowerCase(); const num = waNum(r.phone); if (e && num && waYes(r.data?.whatsapp) && !people.has(e)) people.set(e, num) }
  if (!people.size) return []
  const since = new Date(Date.now() - 4 * 24 * H).toISOString()
  const { data: offers } = await sb.from('offers').select('*').or(`created_at.gte.${since},extra_discount_at.gte.${since},discount_reminder_sent_at.gte.${since}`)
  const { data: done } = await sb.from('agent_tasks').select('tnc_id').eq('type', 'wa_done').limit(1000)
  const skip = new Set((done || []).map(d => d.tnc_id))
  const out = []
  for (const o of offers || []) {
    const num = people.get(String(o.customer_email || '').trim().toLowerCase())
    if (!num || BOUGHT.includes(o.status) || o.unsubscribed) continue
    const ev = [['angebot', o.created_at], ['rabatt', o.extra_discount_at], ['rabatt_erinnerung', o.discount_reminder_sent_at]]
      .filter(([, d]) => d && t(d) >= t(since)).sort((a, b) => t(b[1]) - t(a[1]))[0] // nur das Neueste pro Angebot
    if (!ev) continue
    const id = `${o.id}:wa_${ev[0]}`
    if (skip.has(id)) continue
    out.push({ id, nr: nr(o), name: o.project || 'ohne Projekt', label: WA_KIND[ev[0]], when: when(t(ev[1])), url: `https://wa.me/${num}?text=${encodeURIComponent(waText(o, ev[0]))}` })
  }
  return out
}

export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams
    const { items, logs } = await load()

    if (sp.get('run')) {
      if (process.env.FOLLOWUP_KEY && sp.get('key') !== process.env.FOLLOWUP_KEY) return Response.json({ error: 'Falscher Schlüssel' }, { status: 401 })
      // Push aufs Handy, sobald etwas zur Freigabe bereit liegt (rund um die Uhr, jede Mail nur einmal)
      const ready = items.filter(i => i.manual && i.due <= Date.now())
      if (ready.length) {
        const { data: pushed } = await db().from('agent_tasks').select('tnc_id').eq('type', 'push_sent').in('tnc_id', ready.map(i => i.id))
        const done = new Set((pushed || []).map(p => p.tnc_id))
        const fresh = ready.filter(i => !done.has(i.id))
        if (fresh.length) {
          const names = fresh.map(i => i.o.project || 'ohne Projekt')
          await sendPush({
            title: fresh.length === 1 ? `Emma: ${KIND[fresh[0].kind]} zur Freigabe` : `Emma: ${fresh.length} Mails zur Freigabe`,
            body: `${names.slice(0, 3).join(', ')}${names.length > 3 ? ' und weitere' : ''} ${fresh.length === 1 ? 'wartet' : 'warten'} auf deinen Klick.`,
            tag: 'emma',
          }).catch(() => {})
          await db().from('agent_tasks').insert(fresh.map(i => ({ type: 'push_sent', tnc_id: i.id, status: 'log', done_at: new Date().toISOString() })))
        }
      }
      const open = inWindow(Date.now())
      const done = [], failed = []
      // Außerhalb 8:10 bis 20:00 nur das, was du selbst auf diese Uhrzeit geplant hast
      for (const it of items.filter(i => !i.manual && i.at <= Date.now() && (open || i.custom)).slice(0, 10)) {
        try { await send(it.o, it.kind); done.push(it.id) } catch (e) { failed.push({ id: it.id, error: e.message }) }
      }
      return Response.json({ success: true, sent: done.length, done, failed })
    }

    const now = Date.now()
    const wa = await waList().catch(() => [])
    return Response.json({
      wa,
      approve: items.filter(i => i.manual && i.due <= now).map(i => ({ id: i.id, kind: i.kind, nr: nr(i.o), name: i.o.project || 'ohne Projekt', label: KIND[i.kind] + (i.kind === 'rabatt' ? ' mit Extra-Rabatt' : ' (vor dem Start fällig)'), at: new Date(i.due).toISOString(), last: lastMail(i.o) })),
      night: !inWindow(Date.now()), morning: when(sendAt(Date.now())),
      // Automatische Mails + Rabatt-Mails, die bald zur Freigabe kommen (nächste 36 Std.)
      next: items.filter(i => (!i.manual || i.due > now) && Math.min(i.at, i.due) <= now + 36 * H)
        .map(i => i.manual
          ? { at: i.due, kind: KIND[i.kind], name: i.o.project || 'ohne Projekt', nr: nr(i.o), when: when(i.due), note: 'dann zur Freigabe bei dir' }
          : { id: i.id, at: i.custom ? i.at : Math.max(i.at, sendAt(now)), kind: KIND[i.kind], name: i.o.project || 'ohne Projekt', nr: nr(i.o), orig: !i.custom && !i.approved && i.at > i.due + 10 * 60000 ? when(i.due) : '', note: i.custom ? 'von dir geplant' : i.approved ? 'von dir freigegeben' : i.at > i.due + 10 * 60000 && i.due > START ? 'nachts keine Mails' : '' })
        .sort((a, b) => a.at - b.at).slice(0, 100)
        .map(({ at, ...r }) => ({ ...r, plan: new Date(at).toISOString(), when: r.when || (at <= now + 5 * 60000 ? 'gleich' : when(at)) })),
      sent: logs.slice(0, 5).map(l => ({ kind: l.email, name: l.project || 'ohne Projekt', nr: '', when: when(t(l.done_at || l.created_at)) })),
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { action, id, ids, at, now: force } = await req.json()
    // Planen: eine oder mehrere Mails auf Datum + Uhrzeit legen
    if (action === 'plan') {
      const list = (Array.isArray(ids) ? ids : [id]).filter(x => KIND[String(x || '').split(':')[1]])
      const ms = t(at)
      if (!list.length || !ms) return Response.json({ error: 'Bitte Datum und Uhrzeit wählen' }, { status: 400 })
      const sb = db()
      await sb.from('agent_tasks').update({ status: 'done' }).in('type', ['fu_plan', 'fu_sched']).in('tnc_id', list).eq('status', 'open')
      const { data: offs } = await sb.from('offers').select('id,project').in('id', list.map(x => x.split(':')[0]))
      const nm = new Map((offs || []).map(o => [String(o.id), o.project || '']))
      const { error } = await sb.from('agent_tasks').insert(list.map(x => ({ type: 'fu_plan', tnc_id: x, project: nm.get(x.split(':')[0]) || '', email: KIND[x.split(':')[1]], status: 'open', done_at: new Date(ms).toISOString() })))
      if (error) throw new Error(error.message)
      return Response.json({ success: true, planned: list.length, when: when(ms) })
    }
    if (action === 'wa_done') {
      if (!/:wa_/.test(String(id || ''))) return Response.json({ error: 'Ungültige Aufgabe' }, { status: 400 })
      await db().from('agent_tasks').insert([{ type: 'wa_done', tnc_id: id, status: 'done', done_at: new Date().toISOString() }])
      return Response.json({ success: true })
    }
    const [offerId, kind] = String(id || '').split(':')
    if (!offerId || !KIND[kind]) return Response.json({ error: 'Ungültige Aufgabe' }, { status: 400 })
    if (action === 'skip') {
      await db().from('agent_tasks').insert([{ type: 'fu_skip', tnc_id: id, status: 'done', done_at: new Date().toISOString() }])
      return Response.json({ success: true })
    }
    const { data: o } = await db().from('offers').select('*').eq('id', offerId).maybeSingle()
    if (!o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
    const s = step(o)
    if (!s || s.kind !== kind) return Response.json({ error: 'Diese Mail ist nicht mehr fällig' }, { status: 400 })
    // Nachts nicht stören: zwischen 20:00 und 8:10 Uhr wird die Mail für 8:10 Uhr eingeplant
    if (!force && !inWindow(Date.now())) {
      const { data: ex } = await db().from('agent_tasks').select('id').eq('type', 'fu_sched').eq('tnc_id', id).eq('status', 'open').limit(1)
      if (!ex?.length) await db().from('agent_tasks').insert([{ type: 'fu_sched', tnc_id: id, project: o.project || '', email: KIND[kind], status: 'open' }])
      return Response.json({ success: true, scheduled: when(sendAt(Date.now())) })
    }
    await send(o, kind)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
