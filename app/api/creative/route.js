import { createClient } from '@supabase/supabase-js'
import { knowledgeText } from '../../../lib/wissen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Creative Studio: Mia (Prompts) und Noah (Bild & Video, halbautomatisch über ElevenLabs)
// GET                                           -> Prompts, Warteschlange, fertige Dateien   (angemeldet)
// POST { action:'write', brief, kind, format, count } -> Mia schreibt eine Serie
// POST { action:'rewrite', id }                 -> Mia schreibt einen Prompt neu
// POST { action:'forward', ids }                -> an Noah weiterleiten
// POST { action:'upload', id, name, mime }      -> Upload-Link für das fertige Bild/Video
// POST { action:'uploaded', id, path, mime }    -> Datei gespeichert, Creative ist fertig
// POST { action:'redo', id }                    -> fertiges Creative neu erstellen lassen
// POST { action:'delete', id }
const BUCKET = 'offer-images'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const fail = (e) => Response.json({ error: e.message }, { status: e.status || 500 })
async function user(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  const { data, error } = await db().auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  return data.user
}
const FORMATS = { '1:1': '1:1 square', '4:5': '4:5 portrait (Instagram/Facebook feed)', '9:16': '9:16 vertical (Stories/Reels)', '16:9': '16:9 landscape' }

async function claude(prompt, max = 4000) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY fehlt in Vercel')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: max, messages: [{ role: 'user', content: prompt }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('KI: ' + (j?.error?.message || r.status))
  const txt = (j.content || []).map(c => c.text || '').join('')
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}')
  if (a < 0 || b < a) throw new Error('KI hat kein gültiges Ergebnis geliefert, bitte nochmal versuchen')
  return JSON.parse(txt.slice(a, b + 1))
}

const RULES = (kind, format) => `You are Mia, creative strategist at NeonFrame (neonframe.de), a German shop for custom LED neon signs (text or logo, many colors incl. RGB, backplates cut-out/rectangular/none, indoor and outdoor IP65). Customers are in Germany.
Write prompts for an AI ${kind === 'video' ? 'VIDEO generator (Veo / Seedance). Each prompt describes one 5 to 8 second clip: camera movement, scene, lighting, what happens, mood, sound/music idea' : 'IMAGE generator (GPT Image / Gemini)'}.
Rules:
- Every prompt in ENGLISH, very concrete: setting, the neon sign (exact text, color, glow), lighting, camera/lens, mood, style (photorealistic unless asked otherwise).
- The neon sign is always the hero of the image and clearly readable.
- Any text that should appear IN the image (sign text, headline, discount) stays in GERMAN, inside quotes, e.g. "Bis zu 30% Rabatt". Percentages without space.
- Aspect ratio: ${FORMATS[format] || format}. Mention it at the end of the prompt.
- No brand names of other companies, no real people, no logos of other brands.
- Variety: different rooms, people, angles and colors across the series.`

export async function GET(req) {
  try {
    await user(req)
    const { data, error } = await db().from('creatives').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) throw error
    const v = (r) => ({ id: r.id, series: r.series || '', title: r.title || '', prompt: r.prompt || '', kind: r.kind, format: r.format || '', status: r.status, url: r.file_url || '', mime: r.file_mime || '', at: r.updated_at || r.created_at })
    const rows = data || []
    return Response.json({
      prompts: rows.filter(r => r.status === 'prompt').map(v),
      queue: rows.filter(r => r.status === 'queued').map(v).reverse(),
      done: rows.filter(r => r.status === 'done').sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 60).map(v),
    })
  } catch (e) { return fail(e) }
}

export async function POST(req) {
  try {
    await user(req)
    const b = await req.json()
    const sb = db()
    const now = new Date().toISOString()
    if (b.action === 'write') {
      const brief = String(b.brief || '').trim()
      if (!brief) return Response.json({ error: 'Bitte beschreiben, was du brauchst' }, { status: 400 })
      const kind = b.kind === 'video' ? 'video' : 'image', format = FORMATS[b.format] ? b.format : '4:5'
      const count = Math.min(20, Math.max(1, parseInt(b.count, 10) || 5))
      const wissen = (await knowledgeText().catch(() => '')).slice(0, 6000)
      const out = await claude(`${RULES(kind, format)}

Brief from Phillip (German): ${brief}
Write exactly ${count} prompts.
Background knowledge about NeonFrame (German, use only if helpful):
${wissen}

Answer ONLY with JSON: {"series":"short German series name, max 4 words","items":[{"title":"short German title, max 5 words","prompt":"English prompt"}]}`, 6000)
      const items = (out.items || []).filter(x => x && x.prompt).slice(0, count)
      if (!items.length) throw new Error('KI hat keine Prompts geliefert, bitte nochmal versuchen')
      const series = String(out.series || 'Neue Serie').slice(0, 60)
      const { error } = await sb.from('creatives').insert(items.map(x => ({ series, brief, title: String(x.title || series).slice(0, 80), prompt: String(x.prompt).trim(), kind, format, status: 'prompt', created_at: now, updated_at: now })))
      if (error) throw error
      return Response.json({ success: true, series, count: items.length })
    }
    const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).filter(Boolean)
    if (!ids.length) return Response.json({ error: 'Kein Creative gewählt' }, { status: 400 })
    if (b.action === 'forward') {
      const { error } = await sb.from('creatives').update({ status: 'queued', updated_at: now }).in('id', ids).eq('status', 'prompt')
      if (error) throw error
      return Response.json({ success: true })
    }
    const { data: r } = await sb.from('creatives').select('*').eq('id', ids[0]).maybeSingle()
    if (!r) return Response.json({ error: 'Creative nicht gefunden' }, { status: 404 })
    if (b.action === 'rewrite') {
      const out = await claude(`${RULES(r.kind, r.format)}

Brief from Phillip (German): ${r.brief || r.series}
Rewrite this prompt with a fresh idea (same topic "${r.title}"), not a small variation:
${r.prompt}

Answer ONLY with JSON: {"title":"short German title, max 5 words","prompt":"English prompt"}`, 1500)
      if (!out.prompt) throw new Error('KI hat keinen Prompt geliefert')
      await sb.from('creatives').update({ title: String(out.title || r.title).slice(0, 80), prompt: String(out.prompt).trim(), updated_at: now }).eq('id', r.id)
      return Response.json({ success: true })
    }
    if (b.action === 'upload') {
      const ext = (String(b.name || '').split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const path = `creative/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error) throw error
      return Response.json({ path, url: data.signedUrl })
    }
    if (b.action === 'uploaded') {
      if (!String(b.path || '').startsWith('creative/')) return Response.json({ error: 'Ungültige Datei' }, { status: 400 })
      const url = sb.storage.from(BUCKET).getPublicUrl(b.path).data.publicUrl
      if (r.file_path && r.file_path !== b.path) await sb.storage.from(BUCKET).remove([r.file_path]).catch(() => {})
      await sb.from('creatives').update({ status: 'done', file_url: url, file_path: b.path, file_mime: String(b.mime || ''), updated_at: now }).eq('id', r.id)
      return Response.json({ success: true, url })
    }
    if (b.action === 'redo') {
      await sb.from('creatives').update({ status: 'queued', updated_at: now }).eq('id', r.id)
      return Response.json({ success: true })
    }
    if (b.action === 'delete') {
      if (r.file_path) await sb.storage.from(BUCKET).remove([r.file_path]).catch(() => {})
      await sb.from('creatives').delete().eq('id', r.id)
      return Response.json({ success: true })
    }
    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (e) { return fail(e) }
}
