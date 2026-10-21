import { sb, refresh, status, createQuotation, normalizeCookie } from '../../../lib/tnc'
import { sendPush } from '../../../lib/push'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Einkaufs-Agent (Anna)
// POST ?key=...                 -> neue Kundenanfrage aus dem Konfigurator (kommt von Make)
// GET  ?run=1&key=...           -> TNC-Login täglich prüfen und verlängern (cron-job.org)
// GET                           -> Zentrale: offene Anfragen, zuletzt gesendet, Verbindung   (angemeldet)
// PATCH { id, action, fields }  -> 'send' an TNC senden / 'discard' verwerfen               (angemeldet)
// PUT   { cookie }              -> TNC-Login speichern                                      (nur Admin)

const BUCKET = 'offer-images'
const KEY = () => process.env.FOLLOWUP_KEY
const fail = (e) => Response.json({ error: e.message }, { status: e.status || 500 })

async function user(req, adminOnly) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY fehlt in Vercel'), { status: 500 })
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  const { data, error } = await sb().auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  if (adminOnly && data.user.app_metadata?.role !== 'admin') throw Object.assign(new Error('Nur für Administratoren'), { status: 403 })
  return data.user
}

// Bild (Base64 aus dem Konfigurator) in den Speicher legen
async function upload(b64, name, mime, tag) {
  if (!b64 || String(b64).length < 100) return null
  const raw = String(b64).replace(/^data:[^,]+,/, '')
  const type = mime || 'image/png'
  const ext = (String(name || '').split('.').pop() || (type.includes('jpeg') ? 'jpg' : 'png')).toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `einkauf/${Date.now()}-${tag}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await sb().storage.from(BUCKET).upload(path, Buffer.from(raw, 'base64'), { contentType: type, upsert: true })
  if (error) throw new Error('Bild-Upload: ' + error.message)
  return sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// Werte aus dem Konfigurator -> TNC-Portal
const APP = (v) => /au(ß|ss)en|draussen|ip65/i.test(v || '') ? 'Draussen (IP65 wasserdicht)' : 'Innen'
const PLATE = (v) => /ohne/i.test(v || '') ? 'Ohne Rückenplatte' : /quadrat|recht/i.test(v || '') ? 'Quadratische Rückenplatte' : 'Rückwand ausschneiden'
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'Kunde'

// Anna erkennt die Neonfarben im Logo-Bild (nur das Schild, nicht Wand oder Rückwand)
const COLORS = ['White', 'Warm White', 'Soft Orange', 'Orange', 'Red', 'Purple', 'Peachy Pink', 'Soft Pink', 'Pink', 'Light Green', 'Green', 'Yellow', 'Lake Blue', 'Ice Blue', 'Blue']
async function detectColors(b64, mime) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || !b64) return []
  const m = String(b64).match(/^data:([^;]+);base64,/)
  let type = (m?.[1] || mime || 'image/png').toLowerCase()
  if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) type = 'image/png'
  const data = String(b64).replace(/^data:[^,]+,/, '')
  const ask = `Auf dem Bild ist ein Logo oder eine Vorschau für ein LED-Neonschild. Schau NUR auf das Logo bzw. die Neon-Linien selbst. Ignoriere Hintergrund, Wand, Rückwand, Acrylplatte, Schatten und Raum.
Welche Neonfarben braucht das Schild? Wähle für jede im Logo vorkommende Farbe die passendste aus dieser Liste: ${COLORS.join(', ')}.
Schwarz oder sehr dunkle Linien im Logo werden zu White. Höchstens 4 Farben, die wichtigste zuerst.
Antworte NUR mit JSON: {"colors":["..."]}`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 200, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: type, data } }, { type: 'text', text: ask }] }] }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j?.error?.message || res.status)
  const txt = (j.content || []).map(c => c.text || '').join('')
  const out = JSON.parse((txt.match(/\{[\s\S]*\}/) || ['{}'])[0]).colors || []
  return [...new Set(out.map(x => COLORS.find(c => c.toLowerCase() === String(x).trim().toLowerCase())).filter(Boolean))].slice(0, 4)
}

function view(r) {
  const d = r.data || {}
  return {
    id: r.id, at: r.created_at, kind: r.kind, status: r.status, tnc: r.tnc_id, sent_at: r.sent_at, error: r.error,
    name: r.name, email: r.email, phone: r.phone,
    logo: r.logo_url, preview: r.preview_url, wall: r.wall_url,
    fileName: d.fileName || '',
    text: d.wunschtext || '', font: d.schriftart || '', customerColors: d.neonfarbname || '',
    width: d.breite || '', backplate: d.rueckwandform || '', backplateColor: d.rueckwandfarbe || '', usage: d.verwendungszweck || '',
    notes: d.projektnotizen || '', suggest: d.suggestColors || [],
    tncDefaults: { project: firstName(r.name), size: d.breite || '', application: APP(d.verwendungszweck), backplate: PLATE(d.rueckwandform) },
  }
}

export async function POST(req) {
  try {
    const url = new URL(req.url)
    if (!KEY() || url.searchParams.get('key') !== KEY()) return Response.json({ error: 'Falscher Schlüssel' }, { status: 401 })
    const ct = req.headers.get('content-type') || ''
    const b = ct.includes('json') ? await req.json() : Object.fromEntries((await req.formData()).entries())
    const kind = /mode=logo/i.test(b.seite || '') ? 'logo' : 'text'
    // Nur diese eine Datei geht an TNC: screenshotBase64 (= "neon-vorschau.png" in deiner Mail, bei Logo das Original-Logo)
    const logo_url = await upload(b.screenshotBase64, b.screenshotFilename, b.screenshotMime, 'datei')
    const preview_url = await upload(b.cleanScreenshotBase64, b.cleanScreenshotFilename, b.cleanScreenshotMime, 'vorschau').catch(() => null)
    const wall_url = await upload(b.wandfotoBase64, b.wandfotoFilename, b.wandfotoMime, 'wand').catch(() => null)
    const keep = ['wunschtext', 'schriftart', 'neonfarbname', 'breite', 'rueckwandform', 'rueckwandfarbe', 'verwendungszweck', 'projektnotizen', 'whatsapp', 'seite', 'zeitpunkt']
    const data = Object.fromEntries(keep.map(k => [k, b[k] ?? '']))
    data.fileName = b.screenshotFilename || 'neon-vorschau.png'
    if (kind === 'logo') data.suggestColors = await detectColors(b.screenshotBase64, b.screenshotMime).catch(() => [])
    const { error } = await sb().from('einkauf').insert([{ kind, status: 'open', name: (b.name || '').trim(), email: (b.email || '').trim(), phone: (b.telefon || '').trim(), data, logo_url, preview_url, wall_url }])
    if (error) throw new Error(error.message)
    await sendPush({ title: 'Anna: Neue TNC-Anfrage', body: `${(b.name || 'Kunde').trim().split(/\s+/)[0]} · ${kind === 'logo' ? 'Logo' : 'Text'} · bereit zum Senden an TNC.`, tag: 'ek' }).catch(() => {})
    return Response.json({ success: true })
  } catch (e) { return fail(e) }
}

export async function GET(req) {
  try {
    const url = new URL(req.url)
    if (url.searchParams.get('run')) {
      if (!KEY() || url.searchParams.get('key') !== KEY()) return Response.json({ error: 'Falscher Schlüssel' }, { status: 401 })
      return Response.json(await refresh())
    }
    await user(req)
    const db = sb()
    const [{ data: open }, { data: sent }, conn] = await Promise.all([
      db.from('einkauf').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(30),
      db.from('einkauf').select('*').eq('status', 'sent').order('sent_at', { ascending: false }).limit(5),
      status(),
    ])
    return Response.json({ connection: conn, open: (open || []).map(view), sent: (sent || []).map(view) })
  } catch (e) { return fail(e) }
}

export async function PATCH(req) {
  try {
    await user(req)
    const { id, action, fields = {} } = await req.json()
    const db = sb()
    const { data: r } = await db.from('einkauf').select('*').eq('id', id).maybeSingle()
    if (!r) return Response.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })
    if (r.status !== 'open') return Response.json({ error: 'Diese Anfrage wurde schon bearbeitet' }, { status: 400 })
    if (action === 'discard') {
      await db.from('einkauf').update({ status: 'discarded' }).eq('id', id)
      return Response.json({ success: true })
    }
    if (action !== 'send') return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })

    const v = view(r)
    const colors = (Array.isArray(fields.colors) ? fields.colors : String(fields.colors || v.customerColors).split(',')).map(s => String(s).trim()).filter(Boolean)
    if (!colors.length) return Response.json({ error: 'Bitte mindestens eine Farbe wählen' }, { status: 400 })
    const fileUrl = r.logo_url // genau 1 Datei, TNC kann noch keine mehreren
    if (!fileUrl) return Response.json({ error: 'Keine Datei vorhanden' }, { status: 400 })
    const fr = await fetch(fileUrl, { cache: 'no-store' })
    if (!fr.ok) throw new Error('Datei konnte nicht geladen werden')
    const mimetype = (fr.headers.get('content-type') || 'image/png').split(';')[0]
    const base64 = Buffer.from(await fr.arrayBuffer()).toString('base64')

    const body = {
      logoOrText: r.kind === 'logo' ? 'logo' : 'text',
      uploadedFile: [{ base64, filename: v.fileName || 'logo.png', mimetype }],
      neonText: r.kind === 'text' ? v.text : '',
      selectedFont: r.kind === 'text' ? v.font : '',
      selectedColors: colors.join(', '),
      selectedSize: String(fields.size ?? v.tncDefaults.size).trim() || 'Kleinstmögliche Größe',
      selectedApplication: fields.application || v.tncDefaults.application,
      selectedBackPlate: fields.backplate || v.tncDefaults.backplate,
      projectName: String(fields.project || v.tncDefaults.project).trim(),
      projectNotes: String(fields.note || '').trim(),
    }
    try {
      const tnc = await createQuotation(body)
      await db.from('einkauf').update({ status: 'sent', tnc_id: tnc, sent_at: new Date().toISOString(), error: null, data: { ...r.data, sentBody: { ...body, uploadedFile: [{ filename: body.uploadedFile[0].filename, mimetype }] } } }).eq('id', id)
      return Response.json({ success: true, tnc })
    } catch (e) {
      await db.from('einkauf').update({ error: e.message }).eq('id', id)
      throw e
    }
  } catch (e) { return fail(e) }
}

export async function PUT(req) {
  try {
    await user(req, true)
    const { cookie } = await req.json()
    const c = normalizeCookie(cookie)
    if (!c) return Response.json({ error: 'Bitte den Login-Wert einfügen' }, { status: 400 })
    const r = await refresh(c)
    if (!r.ok) return Response.json({ error: r.error || 'Login ungültig. Bitte im TNC-Portal neu anmelden und den Wert erneut kopieren.' }, { status: 400 })
    return Response.json({ success: true, expires: r.expires, name: r.name })
  } catch (e) { return fail(e) }
}
