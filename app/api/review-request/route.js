import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  const { customerEmail, customerName } = await request.json()
  if (!customerEmail) return NextResponse.json({ error: 'Keine E-Mail' }, { status: 400 })

  const firstName = customerName?.split(' ')[0] || 'dort'

const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td style="background:#0a0a0a;border-radius:14px 14px 0 0;padding:28px;text-align:center">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" height="52" style="display:block;margin:0 auto">
        </td></tr>
        <tr><td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:3px;font-size:0">&nbsp;</td></tr>
        <tr><td style="background:#fff;padding:36px 32px 28px">
          <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#111">Hallo ${firstName},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.8">wir hoffen, dass Sie mit Ihrem neuen Neonschild zufrieden sind und es Ihren Erwartungen entspricht.</p>
          <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.8">Wir würden uns sehr freuen, wenn Sie sich einen kurzen Moment Zeit für eine Bewertung nehmen würden. Ihr Feedback hilft uns, unseren Service weiter zu verbessern und unterstützt andere Kunden bei ihrer Entscheidung.</p>
          <p style="margin:0 0 28px;font-size:15px;color:#444;line-height:1.8">Vielen Dank für Ihr Vertrauen und Ihre Unterstützung!</p>
          <div style="text-align:center;margin:32px 0">
            <a href="https://de.trustpilot.com/evaluate/neonframe.de" target="_blank"
              style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:15px;font-weight:700;">
              Jetzt Bewertung abgeben
            </a>
          </div>
          <p style="margin:24px 0 4px;font-size:15px;color:#444;line-height:1.8">Bei Fragen oder Anliegen stehen wir Ihnen selbstverständlich jederzeit gerne zur Verfügung.</p>
          <p style="margin:20px 0 4px;font-size:15px;color:#444;">Viele Grüße</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#111;">Dein NeonFrame-Team</p>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 14px 14px;padding:16px;text-align:center">
          <p style="margin:0;font-size:12px;color:#aaa">
            <a href="https://neonframe.de" target="_blank" style="color:#aaa;text-decoration:none;">neonframe.de</a>
            · info@neonframe.de
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

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
