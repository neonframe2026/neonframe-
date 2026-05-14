import { NextResponse } from 'next/server'

export async function POST(request) {
  const { message, offerNum, customerName } = await request.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Keine Nachricht' }, { status: 400 })
  }

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) {
    return NextResponse.json({ error: 'E-Mail nicht konfiguriert' }, { status: 500 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'NeonFrame Angebote <angebote@neonframe.de>',
      to: ['info@neonframe.de'],
      subject: `💬 Neue Anfrage – Angebot #${offerNum || 'unbekannt'}`,
      html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- HEADER -->
        <tr><td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:28px 36px;text-align:center">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735"
               alt="NeonFrame" height="48" style="display:block;margin:0 auto 0">
        </td></tr>

        <!-- CYAN STRIPE -->
        <tr><td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:3px;font-size:0">&nbsp;</td></tr>

        <!-- BODY -->
        <tr><td style="background:#ffffff;padding:36px 36px 28px">

          <!-- Title -->
          <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111">Neue Kundenanfrage</h1>
          <p style="margin:0 0 28px;font-size:14px;color:#888">Eingegangen über die Angebotsseite</p>

          <!-- Info Pills -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              <td width="50%" style="padding-right:8px">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px">
                  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:4px">Angebot</div>
                  <div style="font-size:16px;font-weight:700;color:#111">#${offerNum || '–'}</div>
                </div>
              </td>
              <td width="50%" style="padding-left:8px">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px">
                  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:4px">Kunde</div>
                  <div style="font-size:16px;font-weight:700;color:#111">${customerName || '–'}</div>
                </div>
              </td>
            </tr>
          </table>

          <!-- Message -->
          <div style="margin-bottom:8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Nachricht</div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #60c8f0;border-radius:0 10px 10px 0;padding:18px 20px;font-size:15px;line-height:1.7;color:#333;white-space:pre-wrap">${message}</div>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center">
          <p style="margin:0;font-size:12px;color:#aaa">
            Gesendet über <a href="https://angebote.neonframe.de" style="color:#60c8f0;text-decoration:none">angebote.neonframe.de</a>
            &nbsp;·&nbsp; NeonFrame GmbH
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    return NextResponse.json({ error: 'Versand fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
