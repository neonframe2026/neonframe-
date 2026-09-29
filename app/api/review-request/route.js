import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ASSETS = 'https://angebote.neonframe.de/email'
const REVIEW_URL = 'https://de.trustpilot.com/evaluate/neonframe.de'
const FONT = "font-family:Arial,Helvetica,sans-serif;"
const UNSUBSCRIBE = 'mailto:info@neonframe.de?subject=Abmelden'

export async function POST(request) {
  const { customerEmail, customerName } = await request.json()
  if (!customerEmail) return NextResponse.json({ error: 'Keine E-Mail' }, { status: 400 })

  const firstName = customerName?.split(' ')[0] || ''

  const img = (file, alt, link) => {
    const tag = `<img src="${EMAIL_ASSETS}/${file}" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;${FONT}font-size:16px;color:#ffffff">`
    return `<tr><td bgcolor="#09080a" style="background:#09080a;padding:0;font-size:0;line-height:0;mso-line-height-rule:exactly">${link ? `<a href="${link}" target="_blank" style="border:0;text-decoration:none">${tag}</a>` : tag}</td></tr>`
  }

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:#09080a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#09080a">Hallo ${firstName}, wie gefällt dir dein Neon-Schild? Als Dankeschön gibt's 10 % auf deine nächste Bestellung.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09080a" style="background:#09080a">
    <tr><td align="center" style="padding:0">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">

        ${img('bewertung-1-header.jpg', 'Wie gefällt dir dein Neon-Schild? ★★★★★', REVIEW_URL)}
        ${img('bewertung-2-bewerten.jpg', 'Deine ehrliche Bewertung dauert nur 2 Minuten – Jetzt bewerten', REVIEW_URL)}
        ${img('bewertung-3-danke.jpg', 'Unser Dankeschön: 10 % Rabatt auf deine nächste Bestellung mit dem Code DANKE10')}
        ${img('kontakt.png', 'Noch Fragen? Antworte einfach auf diese E-Mail oder schreib an info@neonframe.de', 'mailto:info@neonframe.de')}

        <tr><td align="center" bgcolor="#09080a" style="${FONT}background:#09080a;padding:22px 20px;font-size:12px;line-height:18px;color:#4b5563">
          <a href="https://neonframe.de" style="color:#22d3ee;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#22d3ee;text-decoration:none">info@neonframe.de</a>
          <div style="${FONT}padding-top:12px;font-size:11px;line-height:17px;color:#4b5563">Du erhältst diese E-Mail, weil du bei NeonFrame bestellt hast.<br>Keine E-Mails mehr erhalten? <a href="${UNSUBSCRIBE}" style="color:#6b7280;text-decoration:underline">Hier abmelden</a></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.replace(/>\s+</g, '><')

  try {
    const { error } = await resend.emails.send({
      from: 'NeonFrame <info@neonframe.de>',
      to: customerEmail,
      subject: 'Wie gefällt dir dein NeonFrame-Schild? ⭐',
      headers: { 'List-Unsubscribe': `<${UNSUBSCRIBE}>` },
      html,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
