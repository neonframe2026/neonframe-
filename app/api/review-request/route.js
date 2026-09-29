import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ASSETS = 'https://angebote.neonframe.de/email'
const REVIEW_URL = 'https://de.trustpilot.com/evaluate/neonframe.de'
const CODE = 'DANKE10'
const FONT = "font-family:Arial,Helvetica,sans-serif;"

export async function POST(request) {
  const { customerEmail, customerName } = await request.json()
  if (!customerEmail) return NextResponse.json({ error: 'Keine E-Mail' }, { status: 400 })

  const firstName = customerName?.split(' ')[0] || 'dort'

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
:root{color-scheme:light only;supported-color-schemes:light only}
@media (max-width:600px){ .pad{padding:26px 20px 22px !important} }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f5" style="background:#f4f4f5">
    <tr><td align="center" style="padding:32px 10px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">

        <tr><td bgcolor="#09080a" style="background:#09080a;padding:0;font-size:0;line-height:0">
          <img src="${EMAIL_ASSETS}/header.png" width="600" alt="NeonFrame" style="display:block;width:100%;max-width:600px;height:auto;border:0">
        </td></tr>

        <tr><td class="pad" bgcolor="#ffffff" style="background:#ffffff;padding:36px 36px 28px">

          <div style="${FONT}margin:0 0 16px;font-size:22px;line-height:28px;font-weight:bold;color:#111111">Hallo ${firstName},</div>
          <div style="${FONT}margin:0 0 18px;font-size:15px;line-height:24px;color:#333333">wir hoffen, dein neues Neon-Schild leuchtet schon und macht dir jeden Tag Freude!</div>
          <div style="${FONT}margin:0 0 18px;font-size:15px;line-height:24px;color:#333333">Wir würden uns riesig freuen, wenn du dir 2 Minuten nimmst und uns eine kurze Bewertung schreibst. Dein Feedback hilft uns besser zu werden – und anderen bei ihrer Entscheidung.</div>

          <div style="${FONT}font-size:30px;line-height:36px;color:#f59e0b;letter-spacing:4px;text-align:center">★★★★★</div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="16" style="height:16px;font-size:1px;line-height:1px">&nbsp;</td></tr>
            <tr><td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td align="center" bgcolor="#0ea5e9" style="background:#0ea5e9;border-radius:12px;padding:18px 56px">
                  <a href="${REVIEW_URL}" target="_blank" style="${FONT}font-size:18px;line-height:22px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block"><span style="color:#ffffff;text-decoration:none">Jetzt bewerten</span></a>
                </td>
              </tr></table>
            </td></tr>
            <tr><td height="28" style="height:28px;font-size:1px;line-height:1px">&nbsp;</td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
            <tr><td align="center" style="${FONT}padding:22px">
              <div style="font-size:26px;line-height:30px">🎁</div>
              <div style="${FONT}padding:6px 0 4px;font-size:17px;line-height:24px;font-weight:bold;color:#111111">Unser Dankeschön: 10 % auf deine nächste Bestellung</div>
              <div style="${FONT}padding-bottom:14px;font-size:13px;line-height:19px;color:#666666">Nenn uns den Code einfach bei deiner nächsten Anfrage – wir ziehen die 10 % direkt im Angebot ab:</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
                <td bgcolor="#f0f9ff" style="${FONT}border:2px dashed #0ea5e9;border-radius:10px;padding:10px 26px;font-size:22px;line-height:28px;letter-spacing:4px;font-weight:bold;color:#0369a1;background:#f0f9ff">${CODE}</td>
              </tr></table>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="28" style="height:28px;mso-line-height-rule:exactly;line-height:28px;font-size:1px">&nbsp;</td></tr><tr><td style="padding:0;mso-line-height-rule:exactly;line-height:0;font-size:0"><a href="mailto:info@neonframe.de" style="text-decoration:none;border:0"><img src="${EMAIL_ASSETS}/kontakt.png" width="528" alt="Noch Fragen? Antworte einfach auf diese E-Mail oder schreib an info@neonframe.de" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:12px;${FONT}font-size:14px;line-height:20px;color:#111111"></a></td></tr></table>

          <div style="${FONT}margin:26px 0 4px;font-size:15px;line-height:22px;color:#555555">Viele Grüße</div>
          <div style="${FONT}margin:0;font-size:15px;line-height:22px;font-weight:bold;color:#111111">Dein NeonFrame-Team</div>

        </td></tr>

        <tr><td align="center" bgcolor="#f8fafc" style="${FONT}background:#f8fafc;border-top:1px solid #eeeeee;padding:20px 36px;font-size:12px;line-height:18px;color:#aaaaaa;border-radius:0 0 16px 16px">
          <a href="https://neonframe.de" style="color:#0ea5e9;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#0ea5e9;text-decoration:none">info@neonframe.de</a>
          <div style="${FONT}padding-top:10px;font-size:11px;line-height:17px;color:#aaaaaa">Den Code ${CODE} bekommst du unabhängig davon, ob und wie du bewertest.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.replace(/>\s+</g, '><')

  try {
    await resend.emails.send({
      from: 'NeonFrame <info@neonframe.de>',
      to: customerEmail,
      subject: 'Wie gefällt dir dein NeonFrame-Schild? ⭐',
      html,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
