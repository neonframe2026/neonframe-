import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

// Sarah Krüger (Kundenservice): hält info@neonframe.de sauber und schreibt Antwortentwürfe
// Braucht in Vercel: IMAP_USER, IMAP_PASSWORD, ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY
export const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const IMAP = { host: 'imap.ionos.de', port: 993, secure: true }
const SMTP = { host: 'smtp.ionos.de', port: 465, secure: true }
const START = new Date('2026-10-20T20:00:00Z') // Start: nur Mails ab hier anfassen, nichts Älteres
const MAX_PER_RUN = 12

// Diese Absender fasst Sarah NIE an (bleiben unverändert im Posteingang)
const NEVER = [/theneoncompany/i, /tnc-app/i, /\btnc\b/i, /kenzo/i, /berkouwer/i, /@neonframe\.de$/i, /neonframe angebote/i]

export function imap() {
  return new ImapFlow({ ...IMAP, auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD }, logger: false })
}

// Ordner finden (Namen wie in deinem Outlook)
export async function folders(client) {
  const list = await client.list()
  const by = (fn) => list.find(fn)?.path
  const low = (s) => String(s || '').toLowerCase()
  return {
    trash: by(m => m.specialUse === '\\Trash') || by(m => /papierkorb|trash/i.test(m.name)),
    sent: by(m => m.specialUse === '\\Sent') || by(m => /gesendet|sent/i.test(m.name)),
    personal: by(m => low(m.name) === 'phillip nägele' || low(m.name) === 'phillip naegele'),
    invoices: by(m => low(m.name) === 'rechnungen' && /phillip/i.test(m.path)) || by(m => low(m.name) === 'rechnungen'),
  }
}

// Was weiß Sarah über NeonFrame (für die Antworten)
const WISSEN = `
NeonFrame (neonframe.de) verkauft individuelle LED-Neonschilder, nur in Deutschland.
- Lieferung: Standard 2 bis 3 Wochen. Expresslieferung 7 bis 10 Werktage, Aufpreis +30%.
- Versand ist kostenlos. Schilder bis 110 cm Breite kommen in einem Stück.
- Zahlung im Checkout: PayPal, Klarna oder Kreditkarte.
- RGB-Schilder steuert man mit der mitgelieferten Fernbedienung, es gibt keine App.
- Montage und Elektroanschluss bieten wir nicht an.
- Farben: kein Dunkelgrün, nur Grün und Light Green. Wir können ein echtes Foto der Farbpalette schicken.
- Ablauf: Kunde fragt über den Konfigurator auf neonframe.de an, unsere Designer erstellen eine 3D-Vorschau, das Angebot kommt werktags innerhalb von 6 Stunden per E-Mail.
- Faustregel Größe: ca. 5 bis 10 cm pro Buchstabe, je nach Schriftart.
- Rückwand: konturgeschnitten, rechteckig oder ohne (ohne nur wenn das Design zusammenhängend ist). Innen oder Außen (IP65).
- Da jedes Schild personalisiert ist, gibt es keine Rückgabe.
`

async function ai(m) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY fehlt in Vercel')
  const prompt = `Du bist Sarah, die Assistentin im Kundenservice von NeonFrame. Sortiere diese E-Mail aus dem Posteingang info@neonframe.de.

Kategorien:
- "spam": Betrug, Phishing, Gewinnspiele, offensichtlicher Müll
- "werbung": Newsletter, Marketing, Angebote von Firmen an uns, Kaltakquise (z. B. SEO, Webdesign, Lieferanten-Werbung)
- "persoenlich": private oder persönliche Mails an Phillip Nägele selbst (z. B. Anrede "Herr Nägele" oder "Phillip" in privatem Zusammenhang, Behörden, Bank, Versicherung, Steuer), keine Kundenanfrage
- "rechnung": Rechnungen, Belege, Gutschriften, Zahlungsaufforderungen von Dienstleistern an uns (Shopify, IONOS, Google, Meta ...)
- "kundenfrage": ein Kunde oder Interessent stellt eine Frage zu Schildern, Bestellung, Lieferung, Preis, Montage usw.
- "sonstiges": alles andere (Zahlungseingänge, Bestellbenachrichtigungen, System-Mails, Lieferanten, unklar). Im Zweifel immer "sonstiges".

Nur bei "kundenfrage" schreibst du einen Antwortentwurf. Regeln für den Entwurf:
- Deutsch, freundlich, locker, per "du". Immer genau dieser Aufbau, Absätze durch Leerzeilen getrennt:
Hallo <Vorname>,   (ohne Vorname nur "Hallo,")

vielen Dank für deine Nachricht.   (bei einer Anfrage zu einem Schild: "vielen Dank für deine Anfrage.")

<die eigentliche Antwort, kurz und konkret>

Bei weiteren Fragen stehen wir dir jederzeit gerne zur Verfügung.

Viele Grüße
Dein NeonFrame-Team
- Nur Fakten aus dem Wissen unten. Was du nicht sicher weißt, versprichst du nicht, sondern schreibst, dass wir es prüfen und uns melden.
- Keine Gedankenstriche (– oder —). Prozent ohne Leerzeichen, z. B. "+30%".
- Keine Signatur, die wird automatisch angehängt.

Wissen:
${WISSEN}

E-Mail:
Von: ${m.from_name} <${m.from_email}>
Betreff: ${m.subject}
Text:
${m.body.slice(0, 6000)}

Antworte NUR mit JSON: {"kind":"...","reason":"kurzer Grund auf Deutsch, max 8 Wörter","draft":"... oder leer"}`
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('KI: ' + (j?.error?.message || r.status))
  const txt = (j.content || []).map(c => c.text || '').join('')
  const json = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1))
  const kinds = ['spam', 'werbung', 'persoenlich', 'rechnung', 'kundenfrage', 'sonstiges']
  return { kind: kinds.includes(json.kind) ? json.kind : 'sonstiges', reason: String(json.reason || '').slice(0, 80), draft: json.kind === 'kundenfrage' ? String(json.draft || '').trim() : '' }
}

// Ein Durchlauf: neue Mails im Posteingang ansehen und sortieren
export async function run() {
  if (!process.env.IMAP_USER || !process.env.IMAP_PASSWORD) throw new Error('IMAP_USER / IMAP_PASSWORD fehlen in Vercel')
  const db = sb()
  const client = imap()
  await client.connect()
  const out = { checked: 0, moved: 0, drafts: 0, kept: 0, errors: [] }
  try {
    const F = await folders(client)
    const lock = await client.getMailboxLock('INBOX')
    try {
      const since = new Date(Math.max(START.getTime(), Date.now() - 3 * 86400000))
      const uids = (await client.search({ since }, { uid: true })) || []
      const msgs = []
      for await (const msg of client.fetch(uids.slice(-60), { uid: true, envelope: true, internalDate: true, source: true }, { uid: true })) msgs.push(msg)
      const ids = msgs.map(m => m.envelope?.messageId).filter(Boolean)
      const { data: seen } = ids.length ? await db.from('inbox').select('message_id').in('message_id', ids) : { data: [] }
      const done = new Set((seen || []).map(s => s.message_id))
      const todo = msgs.filter(m => m.envelope?.messageId && !done.has(m.envelope.messageId) && new Date(m.internalDate) >= START).slice(0, MAX_PER_RUN)

      for (const msg of todo) {
        out.checked++
        const e = msg.envelope, f = (e.from || [])[0] || {}
        const row = { uid: msg.uid, message_id: e.messageId, from_name: f.name || '', from_email: (f.address || '').toLowerCase(), subject: e.subject || '(kein Betreff)', received_at: new Date(msg.internalDate).toISOString() }
        try {
          if (NEVER.some(rx => rx.test(row.from_email) || rx.test(row.from_name))) {
            await db.from('inbox').insert([{ ...row, kind: 'geschuetzt', action: 'kept', status: 'done', done_at: new Date().toISOString() }])
            out.kept++; continue
          }
          const p = await simpleParser(msg.source)
          row.body = (p.text || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20000)
          row.snippet = row.body.replace(/\s+/g, ' ').slice(0, 160)
          const c = await ai(row)
          const dest = c.kind === 'spam' || c.kind === 'werbung' ? F.trash : c.kind === 'persoenlich' ? F.personal : c.kind === 'rechnung' ? F.invoices : null
          if (dest) {
            await client.messageMove(String(msg.uid), dest, { uid: true })
            await db.from('inbox').insert([{ ...row, kind: c.kind, action: 'moved', folder: dest, error: c.reason, status: 'done', done_at: new Date().toISOString() }])
            out.moved++
          } else if (c.kind === 'kundenfrage' && c.draft) {
            await db.from('inbox').insert([{ ...row, kind: c.kind, action: 'draft', draft: c.draft, error: c.reason, status: 'open' }])
            out.drafts++
          } else {
            await db.from('inbox').insert([{ ...row, kind: c.kind, action: 'kept', error: c.reason, status: 'done', done_at: new Date().toISOString() }])
            out.kept++
          }
        } catch (err) { out.errors.push(`${row.subject}: ${err.message}`) }
      }
    } finally { lock.release() }
  } finally { await client.logout().catch(() => {}) }
  return out
}

// Rückgängig: Mail aus dem Ordner zurück in den Posteingang
export async function undo(r) {
  const client = imap()
  await client.connect()
  try {
    const lock = await client.getMailboxLock(r.folder)
    try {
      const uids = await client.search({ header: { 'message-id': r.message_id } }, { uid: true })
      if (!uids?.length) throw new Error('Mail im Ordner nicht mehr gefunden')
      await client.messageMove(uids.join(','), 'INBOX', { uid: true })
    } finally { lock.release() }
  } finally { await client.logout().catch(() => {}) }
}

// Signatur und Formatierung wie in deinen Outlook-Mails
const LOGO = 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735'
const SOCIAL = [['Instagram', 'https://www.instagram.com/neonframe.de/'], ['Facebook', 'https://www.facebook.com/people/NeonFrame/61573363756346/'], ['TikTok', 'https://www.tiktok.com/@neonframe.de']]
const escH = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export function toHtml(text) {
  const F = 'font-family:Arial,Helvetica,sans-serif;'
  const paras = String(text).trim().split(/\n\s*\n/).map(p => {
    const lines = p.split('\n').map(l => /^dein neonframe-team$/i.test(l.trim()) ? `<b>${escH(l.trim())}</b>` : escH(l))
    return `<p style="${F}margin:0 0 16px;font-size:14px;line-height:22px;color:#222">${lines.join('<br>')}</p>`
  }).join('')
  const btn = (n, u) => `<td style="${F}border:1px solid #dddddd;background:#f7f7f7;padding:4px 10px;font-size:13px;line-height:20px"><a href="${u}" target="_blank" style="color:#111111;font-weight:bold;text-decoration:underline">${n}</a></td>`
  const sig = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e5e5;margin-top:4px"><tr>
<td style="padding:18px 14px 18px 18px" valign="middle"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #eeeeee;background:#f7f7f7"><tr><td style="padding:14px"><img src="${LOGO}" width="95" alt="NeonFrame" style="display:block;width:95px;height:auto;border:0"></td></tr></table></td>
<td style="${F}padding:16px 18px 16px 10px;font-size:14px;line-height:30px" valign="middle">
&#128222; <a href="tel:+4917656197641" style="color:#1a56db">+49 176 56197641</a><br>
&#9993;&#65039; <a href="mailto:info@neonframe.de" style="color:#1a56db">info@neonframe.de</a><br>
&#127760; <a href="https://neonframe.de" target="_blank" style="color:#1a56db">neonframe.de</a><br>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px"><tr>${SOCIAL.map(([n, u]) => btn(n, u)).join('<td style="width:8px;min-width:8px;font-size:0">&nbsp;</td>')}</tr></table>
</td></tr></table>`
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#ffffff"><div style="max-width:600px;padding:4px 0">${paras}<div style="height:6px"></div>${sig}</div></body></html>`
}
const sigText = '\n\n--\nNeonFrame\nTel. +49 176 56197641\ninfo@neonframe.de\nneonframe.de'

// Antwort senden (über IONOS, landet in "Gesendete Objekte")
export async function reply(r, text) {
  const transport = nodemailer.createTransport({ ...SMTP, auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD } })
  const subject = /^re:/i.test(r.subject) ? r.subject : 'Re: ' + r.subject
  const mail = { from: `NeonFrame <${process.env.IMAP_USER}>`, to: r.from_name ? `"${r.from_name.replace(/"/g, '')}" <${r.from_email}>` : r.from_email, subject, text: text + sigText, html: toHtml(text), inReplyTo: r.message_id, references: [r.message_id] }
  await transport.sendMail(mail)
  // Kopie in "Gesendete Objekte" ablegen und Original als beantwortet markieren
  try {
    const raw = await new Promise((res, rej) => nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(mail, (e, info) => e ? rej(e) : res(info.message)))
    const client = imap()
    await client.connect()
    try {
      const F = await folders(client)
      if (F.sent) await client.append(F.sent, raw, ['\\Seen'])
      const lock = await client.getMailboxLock('INBOX')
      try {
        const uids = await client.search({ header: { 'message-id': r.message_id } }, { uid: true })
        if (uids?.length) await client.messageFlagsAdd(uids.join(','), ['\\Answered', '\\Seen'], { uid: true })
      } finally { lock.release() }
    } finally { await client.logout().catch(() => {}) }
  } catch {}
}
