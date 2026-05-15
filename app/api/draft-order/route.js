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
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" height="48" style="display:block;margin:0 auto">
        </td></tr>
        <tr><td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:3px;font-size:0">&nbsp;</td></tr>
        <tr><td style="background:#ffffff;padding:36px 36px 28px">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111">Hallo ${firstName}! 👋</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#666;line-height:1.6">Ihr individuelles Angebot für Ihr personalisiertes LED-Neon-Schild ist fertig und wartet auf Sie!</p>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:12px">Ihre Konfiguration</div>
            ${offerNum ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f0f0f0"><span style="color:#666">Angebot</span><span style="font-weight:600">#${offerNum}</span></div>` : ''}
            ${width && height ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f0f0f0"><span style="color:#666">Maße</span><span style="font-weight:600">${width} × ${height} cm</span></div>` : ''}
            ${colors ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f0f0f0"><span style="color:#666">Farben</span><span style="font-weight:600">${colors}</span></div>` : ''}
            ${delivery ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f0f0f0"><span style="color:#666">Lieferung</span><span style="font-weight:600">${delivery}</span></div>` : ''}
            ${finalPrice ? `<div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0 0;margin-top:4px"><span style="font-weight:700;color:#111">Gesamtbetrag</span><span style="font-weight:800;color:#111">€ ${parseFloat(finalPrice).toFixed(2)} <span style="font-size:11px;font-weight:400;color:#999">(inkl. MwSt.)</span></span></div>` : ''}
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              <td style="padding-right:8px">
                <a href="${offerLink || '#'}" style="display:block;background:#f8fafc;border:1.5px solid #e2e8f0;color:#111;text-align:center;padding:14px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none">
                  📋 Angebot ansehen
                </a>
              </td>
              ${checkoutUrl ? `<td style="padding-left:8px">
                <a href="${checkoutUrl}" style="display:block;background:#16a34a;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none">
                  🛒 Jetzt bestellen
                </a>
              </td>` : ''}
            </tr>
          </table>

          <p style="margin:0 0 8px;font-size:13px;color:#888;line-height:1.6">Bei Fragen oder Änderungswünschen antworten Sie einfach auf diese E-Mail oder besuchen Sie Ihre Angebotsseite.</p>
          <p style="margin:0;font-size:12px;color:#aaa">⚠️ Da es sich um ein individuell angefertigtes Produkt handelt, besteht gemäß § 312g BGB kein Widerrufsrecht.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center">
          <p style="margin:0;font-size:12px;color:#aaa">
            NeonFrame · <a href="https://neonframe.de" style="color:#60c8f0;text-decoration:none">neonframe.de</a> · <a href="mailto:info@neonframe.de" style="color:#60c8f0;text-decoration:none">info@neonframe.de</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
