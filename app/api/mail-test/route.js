// TEST: schickt Produktions-, Versand- und "Heute"-Mail eines Angebots an info@neonframe.de (nie an den Kunden)
// Aufruf: /api/mail-test?key=DEIN_CRON_SECRET&offer=13287430172
import { createClient } from '@supabase/supabase-js'
import { buildShippedEmail, buildTodayEmail, sendMail, SUBJECT_SHIPPED, SUBJECT_TODAY } from '../../../lib/shipping-emails'

export const dynamic = 'force-dynamic'
const EMAIL_ASSETS = 'https://angebote.neonframe.de/email'
const TO = 'info@neonframe.de'

export async function GET(req) {
  const u = new URL(req.url)
  if (!process.env.CRON_SECRET || u.searchParams.get('key') !== process.env.CRON_SECRET) return Response.json({ error: 'Nicht erlaubt' }, { status: 401 })
  const num = String(u.searchParams.get('offer') || '').trim()
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data } = await db.from('offers').select('*').eq('offer_num', num).limit(1)
  const o = data?.[0]
  if (!o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  const t = { ...o, tracking_number: o.tracking_number || 'JVGL00000000000000000000', tracking_company: o.tracking_company || 'DHL' }
  await sendMail(TO, '[TEST] Danke für deine Bestellung – dein Schild geht in Produktion ✨', buildOrderEmail(o.project?.split(' ')[0], o.offer_num))
  await sendMail(TO, '[TEST] ' + SUBJECT_SHIPPED, buildShippedEmail(t))
  await sendMail(TO, '[TEST] ' + SUBJECT_TODAY, buildTodayEmail(t))
  return Response.json({ success: true, an: TO, mails: 3, statusLink: `https://angebote.neonframe.de/status/${o.offer_num}` })
}

function buildOrderEmail(firstName, offerNum) {
  const statusBtn = offerNum ? `<tr><td bgcolor="#0a0d16" align="center" style="background:#0a0d16;padding:6px 24px 30px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#3aa8ff" style="background:#3aa8ff;border-radius:12px">
<a href="https://angebote.neonframe.de/status/${offerNum}" target="_blank" style="display:inline-block;padding:16px 38px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#06121f;text-decoration:none;border-radius:12px">📦 Bestellstatus ansehen</a></td></tr></table>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8a97ab;margin-top:12px">Hier siehst du jederzeit, wo dein Neonschild gerade ist.</div></td></tr>` : ''
  const img = (file, alt, link) => {
    const tag = `<img src="${EMAIL_ASSETS}/${file}" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;color:#ffffff">`
    return `<tr><td bgcolor="#09080a" style="background:#09080a;padding:0;margin:0;font-size:0;line-height:0;mso-line-height-rule:exactly">${link ? `<a href="${link}" style="border:0;text-decoration:none">${tag}</a>` : tag}</td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:#09080a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#09080a">Hallo ${firstName || ''}, danke für deine Bestellung! Dein Neon-Schild geht jetzt in Produktion.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09080a" style="background:#09080a">
    <tr><td align="center" style="padding:0">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
               ${img('bestellung-1-danke.jpg', 'Danke für deine Bestellung – dein Schild geht in Produktion')}
        ${statusBtn}
        ${img('bestellung-2-ki-bild.jpg', 'Dein Neon-Schild wird von Hand gefertigt')}
        ${img('bestellung-3-ablauf-v2.jpg', 'So geht es weiter: Produktion (2–4 Werktage), Versand mit Tracking-Link, Auspacken & Leuchten')}
        ${img('bestellung-4-vorteile.jpg', 'Handgefertigt, Premium-LEDs, Plug & Play, kostenloser Versand')}
        ${img('kontakt.png', 'Noch Fragen? Antworte einfach auf diese E-Mail oder schreib an info@neonframe.de', 'mailto:info@neonframe.de')}
        <tr><td align="center" bgcolor="#09080a" style="background:#09080a;padding:22px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280">
          <a href="https://neonframe.de" style="color:#22d3ee;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#22d3ee;text-decoration:none">info@neonframe.de</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.replace(/>\s+</g, '><')
}
