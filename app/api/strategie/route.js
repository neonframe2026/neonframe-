import { sb, periods, loadData, stats, claude, context, PERSONA } from '../../../lib/strategie'
import { sendPush } from '../../../lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Strategie & Planung (angemeldet)
// GET                                   -> Kennzahlen (Woche/Monat/Jahr), Berichte, Ziele, Chats, Kampagnen
// POST { action:'report', period }      -> David schreibt den Bericht (week | month | year)
// POST { action:'chat', agent, text }   -> mit David oder Clara schreiben
// POST { action:'goal', title, metric, target } / { action:'goal_done', id } / { action:'delete', id }
// POST { action:'campaign_from_chat' }  -> Clara legt aus dem Chat eine Kampagne an
// POST { action:'step', id, i }         -> Schritt einer Kampagne abhaken
// POST { action:'campaign_status', id, status }
const fail = (e) => Response.json({ error: e.message }, { status: e.status || 500 })
async function user(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  const { data, error } = await sb().auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  return data.user
}
const METRICS = { umsatz: 'Umsatz (€)', verkaeufe: 'Verkäufe', angebote: 'Angebote', anfragen: 'Anfragen', conversion: 'Conversion (%)', frei: 'Eigenes Ziel' }

// Kampagnen-Kalender beim ersten Öffnen mit den wichtigsten Terminen füllen
async function seed(db) {
  const { count } = await db.from('strategie').select('id', { count: 'exact', head: true }).eq('type', 'campaign')
  if (count) return
  const y = new Date().getFullYear()
  const bf = (yy) => { const d = new Date(Date.UTC(yy, 10, 1)); const th = (4 - d.getUTCDay() + 7) % 7; return new Date(Date.UTC(yy, 10, 1 + th + 21 + 1)) } // Freitag nach dem 4. Donnerstag
  const mother = (yy) => { const d = new Date(Date.UTC(yy, 4, 1)); return new Date(Date.UTC(yy, 4, 1 + ((7 - d.getUTCDay()) % 7) + 7)) }
  const iso = (d) => d.toISOString().slice(0, 10)
  const B = bf(y)
  const rows = [
    { title: 'Black Friday', data: { start: iso(new Date(B - 3 * 864e5)), end: iso(new Date(+B + 3 * 864e5)), offer: '50% Rabatt', color: '#ff4fa3', status: 'planung', steps: [] } },
    { title: 'Weihnachten', data: { start: `${y}-12-01`, end: `${y}-12-14`, offer: 'Bestellschluss für Lieferung bis Heiligabend beachten', color: '#ffc04a', status: 'idee', steps: [] } },
    { title: 'Valentinstag', data: { start: `${y + 1}-01-25`, end: `${y + 1}-02-14`, offer: '', color: '#ef4444', status: 'idee', steps: [] } },
    { title: 'Muttertag', data: { start: iso(new Date(mother(y + 1) - 21 * 864e5)), end: iso(mother(y + 1)), offer: '', color: '#34e39b', status: 'idee', steps: [] } },
  ]
  await db.from('strategie').insert(rows.map(r => ({ type: 'campaign', ...r })))
}

// Bericht schreiben und speichern (manuell oder automatisch Montag 8 Uhr)
async function writeReport(db, k, auto) {
      const P = periods(), p = P[k]
      const D0 = await loadData(db, P.year.prev[0] - 40 * 864e5)
      const cmp = [`${p.label}: ${JSON.stringify(stats(D0, p.cur))}`, `${p.prevLabel}: ${JSON.stringify(stats(D0, p.prev))}`, p.ly ? `${p.lyLabel}: ${JSON.stringify(stats(D0, p.ly))}` : '', p.full ? `${p.fullLabel}: ${JSON.stringify(stats(D0, p.full))}` : ''].filter(Boolean).join('\n')
      const out = await claude({
        system: PERSONA.david + '\n\n' + await context(db),
        messages: [{ role: 'user', content: `Schreib den ${k === 'week' ? 'Wochenbericht' : k === 'month' ? 'Monatsbericht' : 'Jahresbericht'} für ${p.label}. Vergleich:\n${cmp}\n\nAntworte NUR mit JSON: {"summary":"2 bis 3 Sätze: wie lief es, wichtigste Veränderung mit Zahl","good":["was gut lief, max 3, kurz"],"bad":["was schlecht lief oder auffällt, max 3, kurz"],"suggestions":[{"title":"konkrete Maßnahme, max 10 Wörter","why":"warum und erwartete Wirkung, 1 Satz","type":"ziel oder kampagne"}]} mit 3 bis 5 Vorschlägen, nach Wirkung sortiert. Wenn kaum Daten da sind, sag das ehrlich und schlag vor, was zuerst gemessen werden sollte.` }],
        max: 1800, json: true,
      })
      await db.from('strategie').insert([{ type: 'report', key: p.key, title: p.label, data: { auto: !!auto, seen: !auto, summary: out.summary || '', good: out.good || [], bad: out.bad || [], suggestions: (out.suggestions || []).slice(0, 6) } }])
}

export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams
    if (sp.get('run')) {
      // cron-job.org täglich 8:00: fehlende Berichte schreiben (Woche am Montag, Monat am 1., Jahr im Januar)
      if (!process.env.FOLLOWUP_KEY || sp.get('key') !== process.env.FOLLOWUP_KEY) return Response.json({ error: 'Falscher Schlüssel' }, { status: 401 })
      const db = sb(), P = periods(), done = []
      const m = +new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(5, 7)
      for (const k of ['week', 'month', ...(m === 1 ? ['year'] : [])]) {
        const { count } = await db.from('strategie').select('id', { count: 'exact', head: true }).eq('type', 'report').eq('key', P[k].key)
        if (count) continue
        await writeReport(db, k, true); done.push(k)
      }
      if (done.length) await sendPush({ title: 'David: ' + (done.includes('month') ? 'Monatsbericht ist fertig' : 'Wochenbericht ist fertig'), body: 'Zahlen und Vorschläge liegen in der Zentrale bereit.', tag: 'david' }).catch(() => {})
      return Response.json({ success: true, done })
    }
    await user(req)
    const db = sb()
    await seed(db)
    const P = periods()
    const D0 = await loadData(db, P.year.prev[0] - 40 * 864e5)
    const S = (r) => (r ? stats(D0, r) : null)
    const { data: rows } = await db.from('strategie').select('*').order('created_at', { ascending: true }).limit(2000)
    const R = rows || []
    const month = S(P.monthRange)
    const goals = R.filter(r => r.type === 'goal' && r.data?.month === P.monthKey).map(r => {
      const m = r.data.metric, target = +r.data.target || 0
      const val = m === 'frei' ? (r.data.done ? 1 : 0) : (month?.[m] || 0)
      return { id: r.id, title: r.title, metric: m, target, value: val, done: !!r.data.done, pct: m === 'frei' ? (r.data.done ? 100 : 0) : target ? Math.min(100, Math.round(val / target * 100)) : 0 }
    })
    const per = {}
    for (const k of ['week', 'month', 'year']) {
      const p = P[k]
      const rep = R.filter(r => r.type === 'report' && r.key === p.key).pop()
      per[k] = { key: p.key, label: p.label, prevLabel: p.prevLabel, nowLabel: p.nowLabel, lyLabel: p.lyLabel || '', fullLabel: p.fullLabel || '', cur: S(p.cur), prev: S(p.prev), ly: S(p.ly), full: S(p.full), now: S(p.now), nowPrev: S(p.nowPrev), nowPrevLabel: p.nowPrevLabel, report: rep ? { ...rep.data, at: rep.created_at } : null }
    }
    const chat = (a) => R.filter(r => r.type === 'chat' && r.key === a).slice(-40).map(r => ({ role: r.data?.role, text: r.content, at: r.created_at }))
    return Response.json({
      periods: per, monthName: P.monthName, metrics: METRICS, goals,
      chat: { david: chat('david'), clara: chat('clara') },
      campaigns: R.filter(r => r.type === 'campaign').map(r => ({ id: r.id, title: r.title, ...r.data })).sort((a, b) => String(a.start).localeCompare(String(b.start))),
    })
  } catch (e) { return fail(e) }
}

export async function POST(req) {
  try {
    await user(req)
    const b = await req.json()
    const db = sb()
    if (b.action === 'report') {
      await writeReport(db, ['week', 'month', 'year'].includes(b.period) ? b.period : 'week')
      return Response.json({ success: true })
    }
    if (b.action === 'seen') {
      const { data: rows } = await db.from('strategie').select('id,data').eq('type', 'report').eq('key', String(b.key || ''))
      for (const r of rows || []) if (!r.data?.seen) await db.from('strategie').update({ data: { ...r.data, seen: true } }).eq('id', r.id)
      return Response.json({ success: true })
    }
    if (b.action === 'chat') {
      const agent = b.agent === 'clara' ? 'clara' : 'david'
      const text = String(b.text || '').trim().slice(0, 4000)
      if (!text) return Response.json({ error: 'Nachricht ist leer' }, { status: 400 })
      const { data: hist } = await db.from('strategie').select('content,data').eq('type', 'chat').eq('key', agent).order('created_at', { ascending: false }).limit(20)
      const msgs = (hist || []).reverse().map(r => ({ role: r.data?.role === 'ai' ? 'assistant' : 'user', content: r.content }))
      msgs.push({ role: 'user', content: text })
      while (msgs.length && msgs[0].role !== 'user') msgs.shift()
      const LEN = { kurz: 'SEHR KURZ: höchstens 80 Wörter, nur das Wichtigste, keine Überschriften.', normal: 'Kurz: höchstens ca. 250 Wörter.', lang: 'Ausführlich: so detailliert wie nötig, mit Plan und Zahlen.' }[b.len] || 'Kurz: höchstens ca. 250 Wörter.'
      const reply = await claude({ system: PERSONA[agent] + `\n\nAntwortlänge: ${LEN} Halte dich STRENG daran. Wenn Phillip im Chat sagt, wie du antworten sollst (kürzer, länger, ohne Listen usw.), gilt das ab sofort für alle weiteren Antworten, bis er es ändert. Lieber kurz antworten und anbieten, Details zu ergänzen. Bei Plänen nummerierte Schritte mit Datum. Stell eine Rückfrage, wenn dir etwas Wichtiges fehlt.\n\n` + await context(db), messages: msgs, max: 1800 })
      await db.from('strategie').insert([{ type: 'chat', key: agent, content: text, data: { role: 'me' } }, { type: 'chat', key: agent, content: reply, data: { role: 'ai' } }])
      return Response.json({ success: true, reply })
    }
    if (b.action === 'reject') {
      // Vorschlag ablehnen: verschwindet und David merkt sich, dass er so etwas nicht mehr vorschlagen soll
      const { data: rep } = await db.from('strategie').select('*').eq('type', 'report').eq('key', String(b.key || '')).order('created_at', { ascending: false }).limit(1)
      const r = rep?.[0]; if (!r) return Response.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
      const s = (r.data?.suggestions || [])[+b.i]
      await db.from('strategie').update({ data: { ...r.data, rejected: [...new Set([...(r.data?.rejected || []), +b.i])] } }).eq('id', r.id)
      if (s) await db.from('strategie').insert([{ type: 'rejected', title: String(s.title || '').slice(0, 200) }])
      return Response.json({ success: true })
    }
    if (b.action === 'chat_clear') {
      await db.from('strategie').delete().eq('type', 'chat').eq('key', b.agent === 'clara' ? 'clara' : 'david')
      return Response.json({ success: true })
    }
    if (b.action === 'goal') {
      const metric = METRICS[b.metric] ? b.metric : 'frei'
      const P = periods()
      const title = String(b.title || '').trim() || `${METRICS[metric]}: ${b.target}`
      await db.from('strategie').insert([{ type: 'goal', title: title.slice(0, 120), data: { metric, target: +b.target || 0, month: P.monthKey, done: false } }])
      return Response.json({ success: true })
    }
    if (b.action === 'goal_from_chat') {
      // David macht aus dem Chat ein Ziel für diesen Monat
      const { data: hist } = await db.from('strategie').select('content,data').eq('type', 'chat').eq('key', 'david').order('created_at', { ascending: false }).limit(8)
      const chat = (hist || []).reverse().map(r => `${r.data?.role === 'ai' ? 'David' : 'Phillip'}: ${r.content}`).join('\n\n')
      if (!chat) return Response.json({ error: 'Erst mit David schreiben' }, { status: 400 })
      const out = await claude({ system: PERSONA.david + '\n\n' + await context(db), messages: [{ role: 'user', content: `Mach aus dem letzten Vorschlag in diesem Chat EIN messbares Ziel für diesen Monat:\n\n${chat}\n\nAntworte NUR mit JSON: {"title":"kurzes Ziel auf Deutsch, max 8 Wörter","metric":"umsatz|verkaeufe|angebote|anfragen|conversion|frei","target":Zahl oder 0}` }], json: true })
      const metric = METRICS[out.metric] ? out.metric : 'frei'
      const P = periods()
      await db.from('strategie').insert([{ type: 'goal', title: String(out.title || 'Neues Ziel').slice(0, 120), data: { metric, target: +out.target || 0, month: P.monthKey, done: false } }])
      return Response.json({ success: true, title: out.title })
    }
    if (b.action === 'campaign_from_chat') {
      const { data: hist } = await db.from('strategie').select('content,data').eq('type', 'chat').eq('key', 'clara').order('created_at', { ascending: false }).limit(12)
      const chat = (hist || []).reverse().map(r => `${r.data?.role === 'ai' ? 'Clara' : 'Phillip'}: ${r.content}`).join('\n\n')
      if (!chat) return Response.json({ error: 'Erst mit Clara über die Kampagne schreiben' }, { status: 400 })
      // Wird gerade eine bestehende Kampagne weitergeplant? Dann die aktualisieren statt neu anlegen
      const { data: cur } = b.id ? await db.from('strategie').select('*').eq('id', b.id).eq('type', 'campaign').maybeSingle() : { data: null }
      const base = cur ? `Das ist die BESTEHENDE Kampagne, die wir weiterplanen. Behalte alles, was im Chat nicht geändert wurde, und ergänze oder ändere nur, was besprochen wurde:\n${JSON.stringify({ title: cur.title, start: cur.data?.start, end: cur.data?.end, offer: cur.data?.offer, steps: (cur.data?.steps || []).map(s => ({ t: s.t, due: s.due, who: s.who, done: !!s.done })) })}\n\n` : ''
      const out = await claude({ system: PERSONA.clara + '\n\n' + await context(db), messages: [{ role: 'user', content: `${base}${cur ? 'Aktualisiere die Kampagne' : 'Mach aus diesem Chat eine Kampagne für den Kalender'} anhand dieses Chats:\n\n${chat}\n\nAntworte NUR mit JSON: {"title":"Name","start":"YYYY-MM-DD","end":"YYYY-MM-DD","offer":"Angebot kurz","color":"#hex passend","steps":[{"t":"Schritt kurz","due":"YYYY-MM-DD","who":"mia|emma|shop|du"}]}` }], max: 1500, json: true })
      const was = new Map((cur?.data?.steps || []).filter(s => s.done).map(s => [String(s.t).toLowerCase(), true]))
      const data = { ...(cur?.data || {}), start: out.start || cur?.data?.start || '', end: out.end || cur?.data?.end || '', offer: out.offer ?? cur?.data?.offer ?? '', color: cur?.data?.color || (/^#[0-9a-f]{6}$/i.test(out.color || '') ? out.color : '#8f7bff'), status: cur?.data?.status && cur.data.status !== 'idee' ? cur.data.status : 'planung', steps: (out.steps || []).slice(0, 20).map(s => ({ t: String(s.t || ''), due: s.due || '', who: s.who || 'du', done: !!s.done || was.has(String(s.t || '').toLowerCase()) })) }
      if (cur) { await db.from('strategie').update({ title: String(out.title || cur.title).slice(0, 80), data }).eq('id', cur.id); return Response.json({ success: true, title: out.title || cur.title }) }
      const { data: ex } = await db.from('strategie').select('id').eq('type', 'campaign').ilike('title', String(out.title || '').trim()).limit(1)
      if (ex?.[0]) await db.from('strategie').update({ data }).eq('id', ex[0].id)
      else await db.from('strategie').insert([{ type: 'campaign', title: String(out.title || 'Neue Kampagne').slice(0, 80), data }])
      return Response.json({ success: true, title: out.title })
    }
    const { data: r } = await db.from('strategie').select('*').eq('id', b.id).maybeSingle()
    if (!r) return Response.json({ error: 'Nicht gefunden' }, { status: 404 })
    if (b.action === 'goal_done') { await db.from('strategie').update({ data: { ...r.data, done: !r.data?.done } }).eq('id', r.id); return Response.json({ success: true }) }
    if (b.action === 'step') { const steps = [...(r.data?.steps || [])]; if (steps[b.i]) steps[b.i] = { ...steps[b.i], done: !steps[b.i].done }; await db.from('strategie').update({ data: { ...r.data, steps } }).eq('id', r.id); return Response.json({ success: true }) }
    if (b.action === 'campaign_edit') {
      const title = String(b.title || '').trim().slice(0, 80) || r.title
      await db.from('strategie').update({ title, data: { ...r.data, offer: String(b.offer ?? r.data?.offer ?? '').slice(0, 300), start: b.start || r.data?.start || '', end: b.end || r.data?.end || '' } }).eq('id', r.id)
      return Response.json({ success: true })
    }
    if (b.action === 'campaign_status') { await db.from('strategie').update({ data: { ...r.data, status: ['idee', 'planung', 'laeuft', 'fertig'].includes(b.status) ? b.status : 'idee' } }).eq('id', r.id); return Response.json({ success: true }) }
    if (b.action === 'delete') { await db.from('strategie').delete().eq('id', r.id); return Response.json({ success: true }) }
    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (e) { return fail(e) }
}
