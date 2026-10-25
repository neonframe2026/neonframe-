import { sb } from './tnc'
import { sendPush } from './push'

// Anna: TNC-Anfrage aus einer Logo-Anfrage per Mail, Instagram oder Facebook anlegen
const BUCKET = 'offer-images'
const COLORS = ['White', 'Warm White', 'Soft Orange', 'Orange', 'Red', 'Purple', 'Peachy Pink', 'Soft Pink', 'Pink', 'Light Green', 'Green', 'Yellow', 'Lake Blue', 'Ice Blue', 'Blue']

// Feste Antwort auf Logo-Anfragen (per du)
export function logoReply(name, askEmail) {
  const first = String(name || '').normalize('NFKC').replace(/[^\p{L}\s'-]/gu, '').trim().split(/\s+/)[0] || ''
  return `${first ? `Hallo ${first},` : 'Hallo,'}

vielen Dank für deine Anfrage und dein Interesse an unseren LED-Neonschildern!

Wir haben dein Logo bereits an unser Designerteam weitergeleitet. Unsere Designer erstellen nun eine individuelle 3D-Vorschau, damit du sehen kannst, wie dein Logo als LED-Neonschild umgesetzt und produziert werden könnte. Dabei achten wir darauf, das ursprüngliche Design möglichst originalgetreu wiederzugeben.

Innerhalb von 6 Stunden werktags erhältst du per E-Mail dein unverbindliches Angebot mit:
• einer individuellen 3D-Vorschau deines Neonschildes
• dem genauen Preis
• den möglichen Maßen und Größen bis zu 300 cm Breite

Die technisch umsetzbare Mindestgröße wird im Rahmen der Designerstellung ermittelt.
${askEmail ? '\nSchick uns bitte noch kurz deine E-Mail-Adresse, damit wir dir das Angebot schicken können.\n' : ''}
Bei weiteren Fragen stehen wir dir jederzeit gerne zur Verfügung.

Viele Grüße
Dein NeonFrame-Team`
}

async function detectColors(b64, mime) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || !b64) return []
  const m = String(b64).match(/^data:([^;]+);base64,/)
  const data = String(b64).replace(/^data:[^,]+,/, '').replace(/\s/g, '')
  // Bildtyp an den ersten Bytes erkennen (Dateiname/Angabe stimmt nicht immer)
  const head = Buffer.from(data.slice(0, 24), 'base64')
  let type = head[0] === 0x89 && head[1] === 0x50 ? 'image/png' : head[0] === 0xff && head[1] === 0xd8 ? 'image/jpeg' : head.slice(0, 3).toString() === 'GIF' ? 'image/gif' : head.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : (m?.[1] || mime || 'image/png').toLowerCase()
  if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) throw new Error('Bildformat wird nicht unterstützt')
  if (data.length > 6.5e6) throw new Error('Bild ist zu groß für die Farberkennung')
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

// Neue Anfrage bei Anna anlegen (Bild = Logo des Kunden)
export async function createLogoRequest({ name, email = '', phone = '', buf, mime = 'image/png', fileName = 'logo.png', source = 'Mail', note = '' }) {
  if (!buf || !buf.length) throw new Error('Kein Bild')
  const db = sb()
  const ext = (String(fileName).split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `einkauf/${Date.now()}-${source.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error: ue } = await db.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true })
  if (ue) throw new Error('Bild-Upload: ' + ue.message)
  const logo_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  const data = { wunschtext: '', schriftart: '', neonfarbname: '', breite: '', rueckwandform: '', rueckwandfarbe: '', verwendungszweck: '', projektnotizen: note, whatsapp: '', seite: 'mode=logo', zeitpunkt: new Date().toISOString(), fileName, quelle: source }
  if (/^image\//.test(mime)) data.suggestColors = await detectColors(buf.toString('base64'), mime).catch(e => { data.suggestError = e.message; return [] })
  const { error } = await db.from('einkauf').insert([{ kind: 'logo', status: 'open', name: String(name || '').trim(), email: String(email || '').trim(), phone, data, logo_url }])
  if (error) throw new Error(error.message)
  await sendPush({ title: 'Anna: Neue TNC-Anfrage', body: `${String(name || 'Kunde').trim().split(/\s+/)[0]} · Logo per ${source} · bereit zum Senden an TNC.`, tag: 'ek' }).catch(() => {})
}
