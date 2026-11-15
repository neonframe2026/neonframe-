import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { addAlert } from '../../../lib/alerts'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Öffentlich (für den KI-Konfigurator im Shop, ?mode=ki): erstellt EINEN Neon-Entwurf mit Google Gemini.
// Der Shop ruft das 3x parallel auf (v = 0, 1, 2) und bekommt 3 Entwürfe.
// POST { prompt, change?, image? (data-URL des gewählten Entwurfs), v } -> { image: 'data:image/png;base64,...' }
// Env: GEMINI_API_KEY (Pflicht), GEMINI_IMAGE_MODEL (optional, Standard gemini-nano-banana-2.1)
// Schutz: nur vom Shop aus, max. LIMIT Bilder pro IP und Tag (Tabelle ki_designs).
const ORIGINS = ['https://neonframe.de', 'https://www.neonframe.de', 'https://atcbcn-sh.myshopify.com']
const LIMIT = 20 // max. 20 Bilder (= 5 Generierungen à 4 Entwürfe) pro Tag und IP
const MODEL = () => process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1'

const COLORS = 'White #ffffff, Warm White #fff3cf, Yellow #f6ff2f, Soft Orange #ff9b2f, Orange #ff6a1f, Red #ff2b2b, Peachy Pink #ff8fa3, Pink #ff2f8f, Soft Pink #ff42d6, Purple #a94cff, Blue #304bff, Ice Blue #73f3ff, Lake Blue #57ffd6, Green #4cff73, Light Green #b7ff3f'

const RULES = `Rules (very important):
- Pure solid black background (#000000) and nothing else: no wall, no room, no backing board, no acrylic plate, no screws, no standoffs, no cables, no shadows, no frame, no mockup.
- Straight front view, flat, centered, square image. The design fills about 80% of the image.
- The design is made only of glowing LED neon tube lines (about 8 mm thick) with a soft realistic glow.
- Use ONLY these neon colors (choose 1 to 3 that fit best): ${COLORS}. No other colors, no gradients inside one tube.
- Any text must be spelled exactly as the customer wrote it, every letter correct and readable.
- Simple line art that can really be produced as a neon sign: no filled areas, no photos, no tiny details, no 3D letters.
- No watermark, no extra words, no signature.
- Exactly ONE single neon sign in the image. Never show several signs, variations, a grid or a collage, even if the customer asks for several designs.`

const STYLES = [
  'Version style: elegant, flowing script lettering where text appears.',
  'Version style: bold, modern and clean lettering where text appears.',
  'Version style: playful, creative layout with a strong eye-catching composition.',
  'Version style: minimal and clean, few lines, very simple and timeless.',
]

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const hash = (s) => crypto.createHash('sha256').update('nf-ki|' + s).digest('hex').slice(0, 32)

function cors(req) {
  const origin = req.headers.get('origin') || ''
  return { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: cors(req) })
}

// Warnung aufs Handy, wenn Google streikt (höchstens 1x pro Stunde)
async function kiAlert(sb, status, txt) {
  try {
    const { data } = await sb.from('settings').select('value').eq('key', 'ki_alert_at').maybeSingle()
    if (data?.value && Date.now() - Number(data.value) < 36e5) return
    await sb.from('settings').upsert({ key: 'ki_alert_at', value: String(Date.now()) }, { onConflict: 'key' })
    const leer = status === 429 || /quota|billing|exhausted|credit/i.test(txt || '')
    await addAlert({
      kind: 'ki',
      title: leer ? '⚠️ KI-Designer: Google-Guthaben leer?' : '⚠️ KI-Designer gestört',
      body: leer ? 'Google lehnt die Bilder ab (Limit/Guthaben). Bitte in Google AI Studio die Abrechnung prüfen.' : `Google meldet Fehler ${status}. Kunden können gerade keine KI-Designs erstellen.`,
      tag: 'ki-alert',
    })
  } catch {}
}

export async function POST(req) {
  const headers = cors(req)
  const fail = (m, s = 400) => Response.json({ error: m }, { status: s, headers })
  const origin = req.headers.get('origin') || ''
  if (!ORIGINS.includes(origin)) return fail('Nicht erlaubt', 403)
  if (!process.env.GEMINI_API_KEY) return fail('Der KI-Designer ist gerade nicht verfügbar.', 500)

  let b
  try { b = await req.json() } catch { return fail('Ungültige Anfrage') }
  const prompt = String(b.prompt || '').trim().slice(0, 1200)
  const change = String(b.change || '').trim().slice(0, 800)
  const v = Math.max(0, Math.min(3, +b.v || 0))
  if (prompt.length < 3) return fail('Bitte beschreib dein Neonschild etwas genauer.')

  // Tageslimit pro Gerät (IP, gehasht gespeichert)
  const sb = db()
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x'
  const who = hash(ip)
  const since = new Date(Date.now() - 864e5).toISOString()
  const { count } = await sb.from('ki_designs').select('id', { count: 'exact', head: true }).eq('ip', who).gte('created_at', since)
  if ((count || 0) >= LIMIT) return fail('Du hast dein Limit für heute erreicht. In 24 Stunden kannst du wieder neue Entwürfe erstellen. Wähl bis dahin einfach deinen Lieblingsentwurf, unsere Designer passen ihn danach für dich an. 😊', 429)

  // Anfrage an Gemini
  const parts = []
  const img = typeof b.image === 'string' && b.image.startsWith('data:image/') && change ? b.image : null
  if (img) {
    const m = img.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
    if (m && m[2].length < 3_000_000) parts.push({ inlineData: { mimeType: m[1], data: m[2] } })
  }
  const text = parts.length
    ? `This image is the current design of a custom LED neon sign. Change it exactly as the customer asks and keep everything else the same.\nCustomer change request (German): "${change}"\nOriginal customer request (German): "${prompt}"\n${v ? 'Make this a slightly different variation of the change.' : ''}\n\n${RULES}`
    : `Create a design for a custom LED neon sign for a German neon sign shop.\nCustomer request (German): "${prompt}"${change ? `\nAdditional wish: "${change}"` : ''}\n${STYLES[v]}\n\n${RULES}`
  parts.push({ text })

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
    })
    const j = await r.json()
    if (!r.ok) {
      console.error('Gemini', r.status, JSON.stringify(j).slice(0, 500))
      await kiAlert(sb, r.status, JSON.stringify(j))
      return fail('Das hat leider nicht geklappt. Versuch es bitte gleich nochmal.', 502)
    }
    const out = (j.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data)
    if (!out) return fail('Dazu konnte ich leider kein Design erstellen. Beschreib dein Schild bitte etwas anders.', 422)
    await sb.from('ki_designs').insert([{ ip: who, prompt: (change ? change + ' | ' : '') + prompt, edit: !!img, v }])
    return Response.json({ image: `data:${out.inlineData.mimeType || 'image/png'};base64,${out.inlineData.data}` }, { headers })
  } catch (e) {
    console.error('Gemini', e)
    return fail('Das hat leider nicht geklappt. Versuch es bitte gleich nochmal.', 502)
  }
}
