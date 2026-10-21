import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { knowledgeText } from './wissen'

// Jonas Schröder (Kundenservice): Instagram- und Facebook-Nachrichten, schreibt Antwortentwürfe
// Braucht in Vercel: META_PAGE_TOKEN, META_APP_SECRET, META_VERIFY_TOKEN, ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY
export const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const G = 'https://graph.facebook.com/v21.0'
const TOKEN = () => process.env.META_PAGE_TOKEN

// Kommt die Nachricht wirklich von Meta?
export function validSignature(raw, header) {
  const secret = process.env.META_APP_SECRET
  if (!secret || !header) return false
  const want = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const a = Buffer.from(want), b = Buffer.from(String(header))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function graph(path, opts = {}) {
  const sep = path.includes('?') ? '&' : '?'
  const r = await fetch(`${G}/${path}${sep}access_token=${encodeURIComponent(TOKEN() || '')}`, { cache: 'no-store', ...opts })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j?.error?.message || 'Meta ' + r.status)
  return j
}

// Verbindung prüfen (für die Zentrale)
export async function connection() {
  if (!TOKEN()) return { ok: false, error: 'META_PAGE_TOKEN fehlt in Vercel' }
  try {
    let ig = ''; try { ig = (await graph('me?fields=instagram_business_account{username}')).instagram_business_account?.username || '' } catch {}
    return { ok: true, page: 'NeonFrame', ig }
  } catch (e) { return { ok: false, error: e.message } }
}

async function profile(channel, id) {
  try {
    if (channel === 'ig') { const p = await graph(`${id}?fields=name,username`); return { name: p.name || p.username || '', handle: p.username ? '@' + p.username : '' } }
    const p = await graph(`${id}?fields=first_name,last_name`); return { name: [p.first_name, p.last_name].filter(Boolean).join(' '), handle: '' }
  } catch { return { name: '', handle: '' } }
}

const WISSEN = `
NeonFrame (neonframe.de) verkauft individuelle LED-Neonschilder, nur in Deutschland.
- Lieferung: Standard 2 bis 3 Wochen. Expresslieferung 7 bis 10 Werktage, Aufpreis +30%.
- Versand ist kostenlos. Schilder bis 110 cm Breite kommen in einem Stück.
- Zahlung im Checkout: PayPal, Klarna oder Kreditkarte.
- RGB-Schilder steuert man mit der mitgelieferten Fernbedienung, es gibt keine App.
- Montage und Elektroanschluss bieten wir nicht an.
- Farben: kein Dunkelgrün, nur Grün und Light Green.
- Ablauf: Anfrage über den Konfigurator auf neonframe.de, unsere Designer erstellen eine 3D-Vorschau, das Angebot kommt werktags innerhalb von 6 Stunden per E-Mail.
- Faustregel Größe: ca. 5 bis 10 cm pro Buchstabe, je nach Schriftart.
- Rückwand: konturgeschnitten, quadratisch/rechteckig oder ohne. Innen oder Außen (IP65).
- Da jedes Schild personalisiert ist, gibt es keine Rückgabe.
`

// Entwurf schreiben (oder erkennen, dass keine Antwort nötig ist)
async function draftFor(thread, msgs) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY fehlt in Vercel')
  const chat = msgs.slice(-12).map(m => `${m.dir === 'in' ? 'Kunde' : 'NeonFrame'}: ${m.text}`).join('\n')
  const first = String(thread.name || '').trim().split(/\s+/)[0] || ''
  const prompt = `Du bist Jonas, im Kundenservice von NeonFrame zuständig für ${thread.channel === 'ig' ? 'Instagram-Direktnachrichten' : 'Facebook Messenger'}. Lies den Chat und schreib einen Antwortentwurf auf die letzte Kundennachricht.

Stil: kurz und locker wie im Chat, per "du", Deutsch. Meist 1 bis 3 kurze Sätze, höchstens ein Emoji.
Aufbau:
Hallo ${first || '<ohne Namen nur "Hallo!">'},   (wenn im Chat heute schon begrüßt wurde, keine neue Begrüßung)

<Antwort>

Dein NeonFrame-Team
Regeln:
- Nur Fakten aus dem Wissen unten. Was du nicht sicher weißt, versprichst du nicht, sondern schreibst, dass wir es prüfen und uns melden.
- Für Preise und konkrete Angebote auf den Konfigurator auf neonframe.de verweisen.
- Keine Gedankenstriche (– oder —). Prozent ohne Leerzeichen, z. B. "+30%".
- Hersteller oder Lieferanten nie nennen.
- Wenn keine Antwort nötig ist (nur "Danke", "Ok", ein Emoji, Spam, Werbung an uns), schreib nur: KEINE_ANTWORT

Wissen:
${WISSEN}
${await knowledgeText()}

Chat (älteste zuerst):
${chat}

Schreib NUR den fertigen Antworttext (ohne Anführungszeichen, ohne Erklärung) oder KEINE_ANTWORT.`
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('KI: ' + (j?.error?.message || r.status))
  const txt = (j.content || []).map(c => c.text || '').join('').trim()
  if (!txt) throw new Error('KI hat keinen Text geliefert')
  if (/^KEINE_ANTWORT/.test(txt)) return { reply: false, draft: '' }
  return { reply: true, draft: txt.replace(/^["„]|["“]$/g, '').trim() }
}

const msgText = (m) => m?.text || (m?.attachments?.length ? `[${m.attachments.map(a => a.type === 'image' ? 'Bild' : a.type === 'video' ? 'Video' : a.type === 'audio' ? 'Sprachnachricht' : 'Anhang').join(', ')}]` : '')

// Webhook von Meta verarbeiten. Gibt Anzahl neuer Entwürfe zurück.
export async function handleWebhook(body) {
  const db = sb()
  const channel = body.object === 'instagram' ? 'ig' : body.object === 'page' ? 'fb' : null
  if (!channel) return { drafts: 0 }
  let drafts = 0
  for (const entry of body.entry || []) {
    const own = String(entry.id || '')
    for (const ev of entry.messaging || []) {
      const m = ev.message
      if (!m || !m.mid || m.is_deleted) continue
      const echo = !!m.is_echo || String(ev.sender?.id) === own
      const userId = String(echo ? ev.recipient?.id : ev.sender?.id || '')
      if (!userId || userId === own) continue
      const { data: dup } = await db.from('social_msgs').select('id').eq('mid', m.mid).maybeSingle()
      if (dup) continue // schon gespeichert (z. B. unsere eigene Antwort)
      const at = new Date(ev.timestamp || Date.now()).toISOString()
      let { data: t } = await db.from('social_threads').select('*').eq('channel', channel).eq('user_id', userId).maybeSingle()
      if (!t) {
        const p = echo ? { name: '', handle: '' } : await profile(channel, userId)
        const ins = await db.from('social_threads').insert([{ channel, user_id: userId, name: p.name, handle: p.handle, status: 'idle' }]).select().single()
        if (ins.error) throw new Error(ins.error.message)
        t = ins.data
      } else if (!t.name && !echo) {
        const p = await profile(channel, userId)
        if (p.name) { await db.from('social_threads').update({ name: p.name, handle: p.handle }).eq('id', t.id); t.name = p.name; t.handle = p.handle }
      }
      await db.from('social_msgs').insert([{ thread_id: t.id, mid: m.mid, dir: echo ? 'out' : 'in', text: msgText(m), at }])
      if (echo) {
        // Du hast selbst in der App geantwortet -> Entwurf erledigt
        if (t.status === 'open') await db.from('social_threads').update({ status: 'done', action: 'self', done_at: new Date().toISOString() }).eq('id', t.id)
        continue
      }
      const { data: msgs } = await db.from('social_msgs').select('dir,text,at').eq('thread_id', t.id).order('at', { ascending: true }).limit(40)
      try {
        const d = await draftFor(t, msgs || [])
        await db.from('social_threads').update(d.reply ? { status: 'open', draft: d.draft, error: null, last_in_at: at } : { status: t.status === 'open' ? 'open' : 'idle', last_in_at: at }).eq('id', t.id)
        if (d.reply) drafts++
      } catch (e) {
        await db.from('social_threads').update({ status: 'open', draft: '', error: e.message, last_in_at: at }).eq('id', t.id)
        drafts++
      }
    }
  }
  return { drafts }
}

// Antwort senden (nach Freigabe)
export async function reply(t, text) {
  if (!TOKEN()) throw new Error('META_PAGE_TOKEN fehlt in Vercel')
  const max = t.channel === 'ig' ? 1000 : 2000
  if (text.length > max) throw new Error(`Zu lang für ${t.channel === 'ig' ? 'Instagram' : 'Messenger'} (max. ${max} Zeichen)`)
  const late = t.last_in_at && Date.now() - new Date(t.last_in_at).getTime() > 23.5 * 3600000
  const body = { recipient: { id: t.user_id }, message: { text }, ...(late ? { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' } : { messaging_type: 'RESPONSE' }) }
  const j = await graph('me/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  await sb().from('social_msgs').upsert([{ thread_id: t.id, mid: j.message_id || null, dir: 'out', text }], { onConflict: 'mid', ignoreDuplicates: true })
  return j
}
