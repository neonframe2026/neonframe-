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
        <tr><td style="background:#0a0a0a;border-radius:14px 14px 0 0;padding:24px;text-align:center">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" height="40" style="display:block;margin:0 auto">
        </td></tr>
        <tr><td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:3px;font-size:0">&nbsp;</td></tr>
        <tr><td style="background:#fff;padding:32px 28px 24px">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#111">Hallo ${firstName}! 🎉</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.7">Wir hoffen, dass Ihr neues LED-Neon-Schild bei Ihnen gut angekommen ist und Sie begeistert! ✨</p>
          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.7">Es würde uns sehr freuen, wenn Sie sich kurz die Zeit nehmen würden, uns eine Bewertung zu hinterlassen. Das hilft uns sehr und dauert nur 1 Minute.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="https://de.trustpilot.com/evaluate/neonframe.de" target="_blank"
              style="display:inline-block;background:#00b67a;color:#fff;text-decoration:none;padding:16px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.2px">
              ⭐ Jetzt Bewertung abgeben
            </a>
          </div>
          <p style="margin:0 0 8px;font-size:12px;color:#999;line-height:1.6;text-align:center">Vielen Dank für Ihr Vertrauen in NeonFrame!</p>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 14px 14px;padding:14px;text-align:center">
          <p style="margin:0;font-size:11px;color:#aaa">NeonFrame · neonframe.de · info@neonframe.de</p>
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
