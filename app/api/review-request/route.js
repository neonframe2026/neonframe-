import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  const { customerEmail, customerName } = await request.json()
  if (!customerEmail) return NextResponse.json({ error: 'Keine E-Mail' }, { status: 400 })

  const firstName = customerName?.split(' ')[0] || 'dort'

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

<tr>
<td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:8px 36px;text-align:center">
<img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" height="110" style="display:block;margin:0 auto">
</td>
</tr>

<tr>
<td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:1px;font-size:0">&nbsp;</td>
</tr>

<tr>
<td style="background:#ffffff;padding:36px 36px 28px">

<h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#111">
Hallo ${firstName},
</h1>

<p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.7">
wir hoffen, dass Sie mit Ihrem neuen Neonschild zufrieden sind und es Ihren Erwartungen entspricht.
</p>

<p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.7">
Wir w&uuml;rden uns sehr freuen, wenn Sie sich einen kurzen Moment Zeit f&uuml;r eine Bewertung nehmen w&uuml;rden. Ihr Feedback hilft uns, unseren Service weiter zu verbessern und unterst&uuml;tzt andere Kunden bei ihrer Entscheidung.
</p>

<p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7">
Vielen Dank f&uuml;r Ihr Vertrauen und Ihre Unterst&uuml;tzung!
</p>

<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:48px">
<tr>
<td align="center">
<table cellpadding="0" cellspacing="0" border="0" role="presentation">
<tr>
<td align="center" bgcolor="#16a34a" style="background:#16a34a;border-radius:12px;padding:16px 36px">
<a href="https://de.trustpilot.com/evaluate/neonframe.de" target="_blank" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;display:block">
Jetzt Bewertung abgeben
</a>
</td>
</tr>
</table>
</td>
</tr>
</table>

<p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.7">
Bei Fragen oder Anliegen stehen wir Ihnen selbstverst&auml;ndlich jederzeit gerne zur Verf&uuml;gung.
</p>

<p style="margin:28px 0 4px;font-size:15px;color:#555;line-height:1.7">
Viele Gr&uuml;&szlig;e
</p>

<p style="margin:0;font-size:15px;font-weight:700;color:#111">
Dein NeonFrame-Team
</p>

</td>
</tr>

<tr>
<td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center">
<p style="margin:0;font-size:12px;color:#aaa">
<a href="https://neonframe.de" style="color:#60c8f0;text-decoration:none">neonframe.de</a>
·
<a href="mailto:info@neonframe.de" style="color:#60c8f0;text-decoration:none">info@neonframe.de</a>
</p>
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>`

  try {
    await resend.emails.send({
      from: 'NeonFrame <info@neonframe.de>',
      to: customerEmail,
      subject: 'Wie gefällt Ihnen Ihr NeonFrame Schild? ⭐',
      html,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
