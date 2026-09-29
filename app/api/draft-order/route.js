import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      customerEmail, customerName, offerNum,
      finalPrice, width, height, colors,
      delivery, offerLink, checkoutUrl,
      imageUrl, discount, variant
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
        html: buildCustomerEmail({ customerName, offerNum, offerLink, checkoutUrl, finalPrice, width, height, colors, delivery, imageUrl, discount, variant }),
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

function buildCustomerEmail({ customerName, offerNum, offerLink, checkoutUrl, finalPrice, width, height, colors, delivery, imageUrl, discount, variant }) {
  const firstName = customerName || 'dort'
  const colorText = Array.isArray(colors) ? colors.join(', ') : (colors || '')
  const sizeText = width && height ? `${width} × ${height} cm` : ''
  const specRows = [['Größe', sizeText], ['Ausführung', variant], ['Farben', colorText]]
    .filter(([, v]) => v)
    .map(([l, v]) => `<tr><td style="padding:7px 0;font-size:14px;font-weight:600;color:#475569;width:110px">${l}:</td><td style="padding:7px 0;font-size:14px;color:#111">${v}</td></tr>`)
    .join('')
  const discountBadge = discount
    ? `<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:10px auto 0"><tr><td bgcolor="#10b981" style="background:#10b981;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:800;color:#ffffff;letter-spacing:.04em">${discount} % RABATT</td></tr></table>`
    : ''
  const imageCell = imageUrl
    ? `<td class="stack" width="170" valign="top" style="padding-right:18px;text-align:center"><img class="stack-img" src="${imageUrl}" width="160" alt="Ihre Vorschau" style="display:block;width:160px;height:auto;border-radius:10px;border:2px solid #0ea5e9;margin:0 auto">${discountBadge}</td>`
    : ''
  const steps = [
    ['1', 'Angebot ansehen', 'Prüfen Sie Vorschau und Details – Änderungen sind jederzeit möglich.'],
    ['2', 'Bestellen', 'Mit einem Klick auf der Angebotsseite.'],
    ['3', 'Produktion & Versand', 'Wir fertigen Ihr Schild und halten Sie bei jedem Schritt per E-Mail auf dem Laufenden.'],
  ].map(([n, t, d], i, a) => {
    const last = i === a.length - 1
    return `<tr>
      <td colspan="2" width="42" valign="middle" style="width:42px;padding:0">
        <table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="34" height="34" align="center" valign="middle" bgcolor="#1a8cff" style="width:34px;height:34px;border-radius:50%;background:#1a8cff;background:linear-gradient(135deg,#38bdf8,#0668e1);border:3px solid #e0f2fe;box-shadow:0 0 10px rgba(56,189,248,.75);font-size:14px;font-weight:800;color:#ffffff;line-height:34px;text-align:center">${n}</td></tr></table>
      </td>
      <td valign="middle" style="padding-left:14px;font-size:15px;font-weight:700;color:#111">${t}</td>
    </tr>
    <tr>
      <td width="20" style="width:20px;font-size:0;line-height:0">&nbsp;</td>
      <td width="22" style="width:22px;${last ? '' : 'border-left:2px solid #1a8cff;'}font-size:0;line-height:0">&nbsp;</td>
      <td valign="top" style="padding:4px 0 ${last ? '0' : '22px'} 14px;font-size:14px;line-height:1.5;color:#666">${d}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@media (max-width:600px){
  .pad{padding:26px 20px 22px !important}
  .stack{display:block !important;width:100% !important;padding:0 !important}
  .stack-img{margin:0 auto 10px !important;width:180px !important;height:auto !important}
  .stack-spec{padding-top:12px !important}
}
</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:8px 36px;text-align:center">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" height="110" style="display:block;margin:0 auto">
        </td></tr>
        <tr><td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:3px;font-size:0">&nbsp;</td></tr>
        <tr><td class="pad" style="background:#ffffff;padding:36px 36px 28px">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111">Hallo ${firstName},</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.7">Ihr individuelles Angebot für Ihr personalisiertes LED-Neon-Schild ist fertig. Maße, Farben und alle Details haben wir für Sie zusammengefasst – das Angebot ist für Sie reserviert.</p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:0 0 24px"><tr><td style="padding:16px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              ${imageCell}
              <td class="stack stack-spec" valign="middle"><table width="100%" cellpadding="0" cellspacing="0" border="0">${specRows}</table></td>
            </tr></table>
          </td></tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
            <tr><td align="center">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
                <td align="center" bgcolor="#16a34a" style="background:#16a34a;border-radius:12px;padding:16px 36px">
                  <a href="${offerLink || '#'}" target="_blank" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;display:block">Angebot ansehen</a>
                </td>
              </tr></table>
            </td></tr>
          </table>

          <p style="margin:34px 0 16px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8">So geht es weiter</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">${steps}</table>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#666;text-align:center">Fragen oder Änderungswünsche? Einfach auf diese Mail antworten oder an <a href="mailto:info@neonframe.de" style="color:#0ea5e9;text-decoration:none">info@neonframe.de</a> schreiben.</p>

          <p style="margin:26px 0 4px;font-size:15px;color:#555;line-height:1.7">Viele Grüße</p>
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
