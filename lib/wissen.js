import { createClient } from '@supabase/supabase-js'

// Wissen für Sarah und Jonas (Tabelle "wissen"): Dokumente, eigene Regeln, gelernte Beispiele
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Alles Wissen als Text für die KI
export async function knowledgeText() {
  try {
    const { data } = await db().from('wissen').select('type,title,content,created_at').order('created_at', { ascending: true })
    const rows = data || []
    const docs = rows.filter(r => r.type === 'doc').map(r => `### ${r.title}\n${(r.content || '').trim()}`).join('\n\n').slice(0, 24000)
    const rules = rows.filter(r => r.type === 'rule').map(r => `- ${r.title}: ${(r.content || '').trim()}`).join('\n')
    const ex = rows.filter(r => r.type === 'example').slice(-12).map(r => `Frage: ${r.title}\nSo hat Phillip geantwortet:\n${(r.content || '').trim()}`).join('\n\n---\n\n')
    return [
      docs && `Weiteres Wissen aus Phillips Unterlagen:\n${docs}`,
      rules && `Regeln von Phillip (immer befolgen, gehen vor allem anderen):\n${rules}`,
      ex && `Beispiele, wie Phillip Antworten korrigiert hat (Ton und Inhalt übernehmen):\n${ex}`,
    ].filter(Boolean).join('\n\n')
  } catch { return '' }
}

// Phillip hat einen Entwurf geändert -> als Beispiel merken
export async function addExample({ question, before, after }) {
  if (!after || String(after).trim() === String(before || '').trim()) return
  await db().from('wissen').insert([{ type: 'example', title: String(question || '').slice(0, 300), content: String(after).trim(), meta: { before: String(before || '').slice(0, 4000) } }])
}

// Hochgeladenes Dokument lesen: nur das, was für Kunden wichtig ist
export async function extractDoc({ url, name, mime }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY fehlt in Vercel')
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('Datei konnte nicht geladen werden')
  const buf = Buffer.from(await r.arrayBuffer())
  const isPdf = /pdf/i.test(mime || '') || /\.pdf$/i.test(name || '')
  const source = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }
    : { type: 'text', text: buf.toString('utf8').slice(0, 60000) }
  const ask = `Das ist eine Unterlage von NeonFrame (individuelle LED-Neonschilder, Verkauf nur in Deutschland). Schreib auf Deutsch alle Fakten heraus, die beim Beantworten von KUNDENFRAGEN helfen: Produkt, Material, Optionen, Farben, Größen, Technik, Lieferung, Montage, Garantie und so weiter. Kurze Stichpunkte, keine Gedankenstriche.
WICHTIG: Lass alles weg, was Kunden nicht sehen dürfen: Namen von Herstellern, Lieferanten oder Partnern (z. B. The Neon Company, TNC), Händler- oder Reseller-Infos, Einkaufspreise, Margen, Partnerprogramme, interne Abläufe. Schreib keine Einleitung, nur die Stichpunkte.`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 4000, messages: [{ role: 'user', content: [source, { type: 'text', text: ask }] }] }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error('KI: ' + (j?.error?.message || res.status))
  return (j.content || []).map(c => c.text || '').join('').trim()
}

export { db as wissenDb }
