import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      customerEmail, customerName, offerNum,
      finalPrice, width, height, colors,
      delivery, offerLink, checkoutUrl
    } = body

    const RESEND_KEY = process.env.RESEND_API_KEY

    if (!customerEmail) {
      return NextResponse.json({ success: true, skipped: 'Keine E-Mail angegeben' })
    }

    if (!RESEND_KEY) {
      return NextResponse.json({ error: 'E-Mail nicht konfiguriert' }, { status: 500 })
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NeonFrame <angebote@neonframe.de>',
        to: [customerEmail],
        subject: `Ihr persönliches Neon-Schild – Angebot ist bereit 🎉`,
        html: buildCustomerEmail({ customerName, offerNum, offerLink, checkoutUrl, finalPrice, width, height, colors, delivery }),
      }),
    })

    if (!emailRes.ok) {
      const err = await emailRes.text()
      console.error('Email error:', err)
      return NextResponse.json({ error: 'E-Mail Versand fehlgeschlagen' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function buildCustomerEmail({ customerName, offerNum, offerLink, checkoutUrl, finalPrice, width, height, colors, delivery }) {
  const firstName = customerName?.split(' ')[0] || 'dort'
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:28px 36px;text-align:center">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" height="110" style="display:block;margin:0 auto">
        </td></tr>
        <tr><td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:3px;font-size:0">&nbsp;</td></tr>
        <tr><td style="background:#ffffff;padding:36px 36px 28px">
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#111">Hallo ${firstName},</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.7">Ihr individuelles Angebot für Ihr personalisiertes LED-Neon-Schild ist fertig! 🎉</p>
          <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.7">Wir haben alles nach Ihren Wünschen konfiguriert – Maße, Farben und alle Details sind in Ihrem persönlichen Angebot zusammengefasst.</p>
          <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7">Das Angebot ist für Sie reserviert. Bei Fragen oder Änderungswünschen können Sie uns jederzeit direkt über die Angebotsseite oder per E-Mail unter <a href="mailto:info@neonframe.de" style="color:#60c8f0;text-decoration:none">info@neonframe.de</a> erreichen – wir melden uns schnellstmöglich.</p>
          <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7">Wir freuen uns darauf, Ihr Neon-Schild für Sie zu fertigen!</p>

          <!-- Angebot ansehen Button -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr>
              <td align="center">
                <a href="${offerLink || '#'}" style="display:inline-block;background:#0a0a0a;color:#fff;text-align:center;padding:16px 36px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none">
                  Angebot ansehen
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 4px;font-size:15px;color:#555;line-height:1.7">Viele Grüße</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#111">Dein NeonFrame-Team</p>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center">
          <p style="margin:0;font-size:12px;color:#aaa">
            <a href="https://neonframe.de" style="color:#60c8f0;text-decoration:none">neonframe.de</a> · <a href="mailto:info@neonframe.de" style="color:#60c8f0;text-decoration:none">info@neonframe.de</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
