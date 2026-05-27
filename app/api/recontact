import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req) {
  try {
    const { offerId, customerEmail, customerName, offerLink, price, width, height, colors } = await req.json()

    if (!customerEmail) {
      return Response.json({ error: 'Keine E-Mail-Adresse' }, { status: 400 })
    }

    const firstName = customerName?.split(' ')[0] || 'dort'

    await resend.emails.send({
      from: 'NeonFrame <info@neonframe.de>',
      to: customerEmail,
      subject: `Ihr Angebot wartet noch auf Sie – NeonFrame 💡`,
      html: `
<!DOCTYPE html>
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
        <tr><td style="background:#fff;padding:28px 28px 20px">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111">Hallo ${firstName}! 👋</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6">
            Wir wollten kurz nachfragen – Ihr individuelles NeonFrame-Angebot ist noch aktiv und wartet auf Sie!
          </p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px">Ihre Konfiguration</div>
            ${width && height ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span style="color:#666">Maße</span><span style="font-weight:600">${width} × ${height} cm</span></div>` : ''}
            ${colors ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span style="color:#666">Farben</span><span style="font-weight:600">${colors}</span></div>` : ''}
            ${price ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0 0;margin-top:6px;border-top:1px solid #e2e8f0"><span style="font-weight:700">Gesamtbetrag</span><span style="font-weight:800;color:#111">€ ${parseFloat(price).toFixed(2)}</span></div>` : ''}
          </div>
          <a href="${offerLink}" style="display:block;background:#16a34a;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:16px">
            🛒 Jetzt Angebot ansehen & bestellen
          </a>
          <p style="margin:0 0 8px;font-size:12px;color:#888;line-height:1.6">
            Bei Fragen antworten Sie einfach auf diese E-Mail – wir helfen gerne!
          </p>
          <p style="margin:0;font-size:11px;color:#aaa">⚠️ Kein Widerrufsrecht bei individuell angefertigten Produkten (§ 312g BGB)</p>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 14px 14px;padding:14px;text-align:center">
          <p style="margin:0;font-size:11px;color:#aaa">NeonFrame · neonframe.de · info@neonframe.de</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
      `,
    })

    // Status auf "recontacted" setzen
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://angebote.neonframe.de'
    await fetch(`${baseUrl}/api/offers?id=${offerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'recontacted' }),
    })

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
