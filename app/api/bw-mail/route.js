import { createClient } from '@supabase/supabase-js'
import { logEmail } from '../../../lib/email-log'
import { getBW, currentVk } from '../../../lib/blackweek'

// Black-Week-Mails
// POST { offerId, kind: 'switch' | 'mail1' | 'mail2', to?: 'test@...' }
//   switch = Angebot wurde auf Black Week umgestellt, mail1 = 24 Std. nach dem Angebot, mail2 = Letzte Chance mit Countdown
//   Mit "to" geht eine Testmail nur an diese Adresse (Angebot wird nicht verändert).
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

const SITE = 'https://angebote.neonframe.de'
const ASSETS = `${SITE}/email`
const FONT = 'font-family:Arial,Helvetica,sans-serif;'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
const SUBJECT = {
  switch: 'Gute Nachricht: Dein Neon-Schild jetzt mit 40% Rabatt',
  mail1: 'Black Friday: Du sparst auf dein Neon-Schild',
  mail2: 'Nur noch 2 Tage: Dein Black Friday Preis läuft ab',
}
const PRE = {
  switch: 'Dein Angebot gibt es jetzt mit 40% Black Friday Rabatt.',
  mail1: 'Dein Angebot ist noch reserviert, jetzt mit 40% Black Friday Rabatt.',
  mail2: 'Dein Black Friday Preis ist noch reserviert, aber nicht mehr lange.',
}
const HERO = { switch: 'bw-hero-switch.jpg', mail1: 'bw-hero-1.jpg', mail2: 'bw-hero-2.jpg' }
const WHY = { switch: 'bw-why-1.jpg', mail1: 'bw-why-1.jpg', mail2: 'bw-why-2.jpg' }

// Persönliches Bild einmal bauen und in Supabase Storage speichern (wie bei den anderen Mails)
async function storeImage(offerId, kind) {
  const live = `${SITE}/api/bw-image?offer=${offerId}&kind=${kind}&v=${Date.now()}`
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return live
    const r = await fetch(live)
    if (!r.ok) return live
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key)
    const path = `${offerId}-bw-${kind}-${Date.now()}.png`
    const { error } = await admin.storage.from('email-images').upload(path, Buffer.from(await r.arrayBuffer()), { contentType: 'image/png', cacheControl: '31536000', upsert: true })
    if (error) return live
    return admin.storage.from('email-images').getPublicUrl(path).data.publicUrl
  } catch { return live }
}

function buildHtml({ kind, firstName, link, personal, unsub }) {
  const img = (src, alt, href) => {
    const tag = `<img src="${src}" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;${FONT}font-size:16px;color:#ffffff">`
    return `<tr><td bgcolor="#08080b" style="background:#08080b;padding:0;font-size:0;line-height:0">${href ? `<a href="${href}" target="_blank" style="border:0;text-decoration:none">${tag}</a>` : tag}</td></tr>`
  }
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><style>:root{color-scheme:light only;supported-color-schemes:light only}</style></head>
<body style="margin:0;padding:0;background:#08080b">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#08080b">Hallo ${firstName}, ${PRE[kind]}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#08080b" style="background:#08080b"><tr><td align="center" style="padding:0">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse">
${img(`${ASSETS}/${HERO[kind]}`, 'NeonFrame Black Friday: 40% auf dein Neon-Schild', link)}
${img(personal, `Hallo ${firstName}, dein Angebot mit 40% Black Friday Rabatt ansehen`, link)}
${img(`${ASSETS}/${WHY[kind]}`, kind === 'mail2' ? 'Warum du nicht warten solltest' : 'Warum jetzt? Bestpreis des Jahres, Änderungen gratis, kostenloser Versand, ein Klick', link)}
<tr><td align="center" bgcolor="#08080b" style="${FONT}background:#08080b;padding:6px 34px 0;font-size:14px;line-height:22px;color:#c4cdd8"><b style="color:#22d3ee">Noch etwas ändern?</b> Antworte einfach auf diese E-Mail. Wir passen dein Design kostenlos an.</td></tr>
<tr><td align="center" bgcolor="#08080b" style="${FONT}background:#08080b;padding:28px 20px 0;font-size:15px;line-height:24px;color:#c4cdd8">Viele Grüße<br><b style="color:#ffffff">Dein NeonFrame-Team</b></td></tr>
<tr><td align="center" bgcolor="#08080b" style="${FONT}background:#08080b;padding:26px 20px 30px;font-size:12px;line-height:18px;color:#4b5563">
<a href="https://neonframe.de" style="color:#22d3ee;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#22d3ee;text-decoration:none">info@neonframe.de</a>
<div style="${FONT}padding-top:12px;font-size:11px;line-height:17px;color:#4b5563">Du erhältst diese E-Mail, weil du bei NeonFrame ein Angebot angefragt hast.<br>Keine Erinnerungen mehr erhalten? <a href="${unsub}" target="_blank" style="color:#6b7280;text-decoration:underline">Hier abmelden</a></div>
</td></tr></table></td></tr></table></body></html>`.replace(/>\s+</g, '><')
}

export async function POST(req) {
  try {
    const { offerId, kind, to } = await req.json()
    if (!SUBJECT[kind]) return Response.json({ error: 'Unbekannte Mail' }, { status: 400 })
    const RESEND_KEY = process.env.RESEND_API_KEY
    if (!RESEND_KEY) return Response.json({ error: 'E-Mail nicht konfiguriert' }, { status: 500 })
    const sb = db()
    const { data: o } = await sb.from('offers').select('*').eq('id', offerId).maybeSingle()
    if (!o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
    const test = !!to
    const recipient = test ? to : o.customer_email
    if (!recipient) return Response.json({ error: 'Keine E-Mail-Adresse' }, { status: 400 })
    if (!test && (o.unsubscribed || o.status === 'unsubscribed')) return Response.json({ error: 'Kunde hat sich abgemeldet' }, { status: 400 })

    const firstName = (o.project || '').split(' ')[0] || 'dort'
    const link = `${SITE}/angebot/${o.custom_id || o.id}`
    const unsub = `${SITE}/abmelden/${o.id}`
    const personal = await storeImage(o.id, kind)
    // Betreff mit echter Ersparnis bzw. Resttagen
    let subj = SUBJECT[kind]
    const vk = currentVk(o)
    if (kind === 'mail1' && vk > 0) subj = `Black Friday: Du sparst ${(Math.round((vk / 0.6 - vk) * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € auf dein Neon-Schild`
    if (kind === 'mail2') {
      const days = Math.floor((new Date((await getBW(sb)).end).getTime() - Date.now()) / 864e5)
      subj = days >= 2 ? `Nur noch ${days} Tage: Dein Black Friday Preis läuft ab` : days === 1 ? 'Nur noch 1 Tag: Dein Black Friday Preis läuft ab' : 'Nur noch heute: Dein Black Friday Preis läuft ab'
    }
    const subject = (test ? '[TEST] ' : '') + subj
    const html = buildHtml({ kind, firstName, link, personal, unsub })

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'NeonFrame <info@neonframe.de>', to: [recipient], subject, html, headers: { 'List-Unsubscribe': `<${unsub}>, <mailto:info@neonframe.de?subject=Abmelden>` } }),
    })
    if (!r.ok) return Response.json({ error: 'E-Mail Versand fehlgeschlagen: ' + (await r.text()).slice(0, 200) }, { status: 500 })

    if (!test) {
      await logEmail(o.id, 'bw_' + kind, subject, html, recipient)
      const col = { switch: 'bw_mail_switch_sent_at', mail1: 'bw_mail1_sent_at', mail2: 'bw_mail2_sent_at' }[kind]
      await sb.from('offers').update({ [col]: new Date().toISOString() }).eq('id', o.id)
    }
    return Response.json({ success: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
