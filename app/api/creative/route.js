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

// Echte NeonFrame-Vorteile (nur diese dürfen als Zahlen/Fakten ins Bild)
const USP = `Real NeonFrame facts you may use as ad text (German, short): "Kostenlose 3D-Vorschau", "Angebot in 6 Std." (on workdays), "Gratis Versand", "Lieferung in 2-3 Wochen", "Express in 7-10 Tagen", "Dein Logo als Neonschild", "Jede Schrift, jede Farbe", "Innen & Außen (IP65)", "Made for you".`

const LAYOUTS = `Proven ad layouts (pick a DIFFERENT one for each prompt in a series, never repeat the same layout twice in a row):
1. USP boxes: bold headline top, hero neon sign center, 3 rounded outline boxes with short USPs, pill CTA button bottom.
2. Before/After: headline top, two overlapping room photos labeled "Vorher" (plain, dim room) and "Nachher" (same room with a glowing custom neon sign), CTA button bottom.
3. Split screen: diagonal glowing line splits the image, left side headline + offer badge, right side a real venue (bar, café, salon) with the customer's neon logo.
4. Phone POV: a hand holds a smartphone showing a neon sign design preview on screen, headline above, curved arrow pointing to the phone with a short claim.
5. Billboard / poster mockup: a city wall poster on a street showing the ad with headline and a neon sign graphic.
6. Review card: real-looking venue wall with a neon sign, a white rounded review card overlay with a short German customer quote (generic, no names), star rating.
7. Logo collage: 3-4 different custom neon logos in vertical slices or a fan, headline like "Schick uns dein Logo".
8. Product hero close-up: macro shot of the glowing neon tubes and acrylic backplate, big headline and offer badge over a dark gradient.`

const RULES = (kind, format, refs) => `You are Mia, senior performance creative director at NeonFrame (neonframe.de), a German shop for custom LED neon signs (customer's own text or logo, many colors incl. RGB, acrylic backplate cut to shape / rectangular / none, indoor and outdoor IP65). Ads run on Instagram and Facebook in Germany.
You write prompts for an AI ${kind === 'video' ? 'VIDEO generator (Veo / Seedance). Each prompt is one 5 to 8 second scroll-stopping clip: describe the opening hook in the first second, camera movement, the neon sign switching on or glowing, on-screen text overlays and their timing, mood and music idea' : 'IMAGE generator (GPT Image). Each prompt is one finished, scroll-stopping AD CREATIVE with typography and layout, not just a photo'}.

What makes a good NeonFrame ad:
- It is a complete ad layout: strong short headline, the hero neon sign, 1 to 3 short supporting elements (USP boxes, badge, review card, before/after labels), and a clear CTA button (pill shape, gradient).
- The hero neon sign shows a realistic CUSTOMER sign (fictional café/bar/salon logo, a first name, a short quote like "Good Vibes Only", a gamer tag), NOT the ad slogan. Ad text is graphic typography on top, not neon tubes.
- Dark, premium look: deep navy or black backgrounds, magenta/pink, violet, red or electric blue gradients, strong glow, high contrast, bold modern sans-serif (often italic, uppercase headlines).
- Hook-driven headlines (German, max 6 words), e.g. "Ohne Neon nur ein Zimmer.", "Schick uns dein Logo", "Dein Name. In Neon.", "Black Friday: Dein Logo leuchtet".

${LAYOUTS}

${USP}

Strict rules:
- Prompt text in ENGLISH, very concrete: exact layout positions (top/center/bottom), background, the sign (exact text, colors, backplate), lighting, typography style, colors of boxes and button.
- Every text that appears IN the image is GERMAN, in quotes, spelled exactly, and the prompt ends with: "All text spelled exactly as written, no other text, no brand logos."
- Discounts or prices ONLY if the brief from Phillip states them, use exactly his number (percent without space, e.g. "-50%"). Never invent discounts, customer counts, ratings numbers or delivery promises beyond the facts above.
- Never mention or show other brands, competitors, manufacturers or suppliers, no real people's names or faces of celebrities.
- Aspect ratio: ${FORMATS[format] || format}. Mention it at the start of the prompt.
${refs ? `\nPhillip's favourite reference ads (copy their STYLE, layout ideas and energy, never their logos, brand names or claims):\n${refs}` : ''}`

async function refsText(sb) {
  const { data } = await sb.from('creatives').select('prompt').eq('status', 'ref').order('created_at', { ascending: false }).limit(10)
  return (data || []).map((r, i) => `Ref ${i + 1}: ${r.prompt}`).join('\n').slice(0, 6000)
}

// Vorbild-Ad ansehen und den Stil beschreiben
async function analyzeRef(url, mime) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY fehlt in Vercel')
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('Bild konnte nicht geladen werden')
  let type = (mime || r.headers.get('content-type') || 'image/png').split(';')[0]
  if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) type = 'image/jpeg'
  const data = Buffer.from(await r.arrayBuffer()).toString('base64')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 500, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: type, data } }, { type: 'text', text: 'This is a reference ad for custom LED neon signs. Describe in English, in 3 to 5 short sentences, only what makes it work: layout structure (what is where), headline style and hook, colors and background, typography, supporting elements (badges, boxes, buttons, mockups), mood. Do NOT mention any brand names, logos, company names or specific claims/numbers from the ad.' }] }] }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error('KI: ' + (j?.error?.message || res.status))
  return (j.content || []).map(c => c.text || '').join('').trim()
}

export async function GET(req) {
  try {
    await user(req)
    const { data, error } = await db().from('creatives').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) throw error
    const v = (r) => ({ id: r.id, series: r.series || '', title: r.title || '', prompt: r.prompt || '', kind: r.kind, format: r.format || '', status: r.status, url: r.file_url || '', mime: r.file_mime || '', at: r.updated_at || r.created_at })
    const rows = data || []
    return Response.json({
      refs: rows.filter(r => r.status === 'ref').map(v),
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
      const wissen = (await knowledgeText().catch(() => '')).slice(0, 4000)
      const out = await claude(`${RULES(kind, format, await refsText(sb))}

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
    // Vorbilder: Ads, die Phillip gefallen (Stil wird von Claude beschrieben und bei jedem Prompt mitgegeben)
    if (b.action === 'ref_upload') {
      const ext = (String(b.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `creative/ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error) throw error
      return Response.json({ path, url: data.signedUrl })
    }
    if (b.action === 'ref_add') {
      if (!String(b.path || '').startsWith('creative/ref-')) return Response.json({ error: 'Ungültige Datei' }, { status: 400 })
      const url = sb.storage.from(BUCKET).getPublicUrl(b.path).data.publicUrl
      const style = await analyzeRef(url, b.mime)
      const { error } = await sb.from('creatives').insert([{ series: 'Vorbild', title: String(b.name || 'Vorbild').slice(0, 80), prompt: style, kind: 'image', status: 'ref', file_url: url, file_path: b.path, file_mime: String(b.mime || ''), created_at: now, updated_at: now }])
      if (error) throw error
      return Response.json({ success: true })
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
      const out = await claude(`${RULES(r.kind, r.format, await refsText(sb))}

Brief from Phillip (German): ${r.brief || r.series}
Rewrite this prompt with a fresh idea and a different layout (same topic "${r.title}"), not a small variation. Keep any discount from the brief exactly:
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
