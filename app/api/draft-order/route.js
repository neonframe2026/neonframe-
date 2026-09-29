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

const EMAIL_ASSETS = 'https://angebote.neonframe.de/email'
const FONT = "font-family:Arial,Helvetica,sans-serif;"

function buildCustomerEmail({ customerName, offerNum, offerLink, checkoutUrl, finalPrice, width, height, colors, delivery, imageUrl, discount, variant }) {
  const firstName = customerName || 'dort'
  const colorText = Array.isArray(colors) ? colors.join(', ') : (colors || '')
  const sizeText = width && height ? `${width} × ${height} cm` : ''

  const specRows = [['Größe', sizeText], ['Ausführung', variant], ['Farben', colorText]]
    .filter(([, v]) => v)
    .map(([l, v]) => `<tr>
      <td width="100" valign="top" style="${FONT}padding:6px 0;font-size:14px;line-height:20px;font-weight:bold;color:#475569;width:100px">${l}:</td>
      <td valign="top" style="${FONT}padding:6px 0;font-size:14px;line-height:20px;color:#111111">${v}</td>
    </tr>`).join('')

  const discountBadge = discount ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:10px auto 0">
      <tr><td bgcolor="#10b981" style="${FONT}padding:5px 12px;font-size:12px;line-height:16px;font-weight:bold;color:#ffffff;border-radius:6px">${discount} % RABATT</td></tr>
    </table>` : ''

  const imageCell = imageUrl ? `
    <td class="stack" width="160" valign="top" align="center" style="width:160px;padding:0 18px 0 0">
      <img class="stack-img" src="${imageUrl}" width="140" alt="Ihre Vorschau" style="display:block;width:140px;max-width:140px;height:auto;border:2px solid #0ea5e9;border-radius:10px;margin:0 auto">
      ${discountBadge}
    </td>` : ''

  const steps = [
    ['Angebot ansehen', 'Prüfen Sie Vorschau und Details – Änderungen sind jederzeit möglich.'],
    ['Bestellen', 'Mit einem Klick auf der Angebotsseite.'],
    ['Produktion & Versand', 'Wir fertigen Ihr Schild und halten Sie bei jedem Schritt per E-Mail auf dem Laufenden.'],
  ].map(([t, d], i, a) => {
    const last = i === a.length - 1
    const line = last ? '' : `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr><td width="2" height="40" bgcolor="#1a8cff" style="width:2px;height:40px;font-size:1px;line-height:1px">&nbsp;</td></tr>
        </table>`
    return `<tr>
      <td width="48" valign="top" align="center" style="width:48px">
        <img src="${EMAIL_ASSETS}/step-${i + 1}.png" width="48" height="48" alt="${i + 1}" style="display:block;width:48px;height:48px;border:0">${line}
      </td>
      <td valign="top" style="${FONT}padding:13px 0 0 14px">
        <div style="${FONT}font-size:15px;line-height:22px;font-weight:bold;color:#111111">${t}</div>
        <div style="${FONT}font-size:14px;line-height:21px;color:#666666;padding-top:2px">${d}</div>
      </td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
:root{color-scheme:light only;supported-color-schemes:light only}
@media (max-width:600px){
  .pad{padding:26px 20px 22px !important}
  .stack{display:block !important;width:100% !important;padding:0 !important}
  .stack-img{margin:0 auto 10px !important}
  .stack-spec{padding-top:12px !important}
}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f5" style="background:#f4f4f5">
    <tr><td align="center" style="padding:32px 10px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">

        <tr><td align="center" bgcolor="#0a0a0a" style="background:#0a0a0a;padding:8px 36px;border-radius:16px 16px 0 0">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" width="110" height="110" style="display:block;width:110px;height:110px;border:0;margin:0 auto">
        </td></tr>
        <tr><td height="3" bgcolor="#0ea5e9" style="height:3px;font-size:3px;line-height:3px;background:#0ea5e9">&nbsp;</td></tr>

        <tr><td class="pad" bgcolor="#ffffff" style="background:#ffffff;padding:36px 36px 28px">

          <div style="${FONT}margin:0 0 16px;font-size:22px;line-height:28px;font-weight:bold;color:#111111">Hallo ${firstName},</div>
          <div style="${FONT}margin:0 0 20px;font-size:15px;line-height:24px;color:#333333">Ihr individuelles Angebot für Ihr personalisiertes LED-Neon-Schild ist fertig. Maße, Farben und alle Details haben wir für Sie zusammengefasst – das Angebot ist für Sie reserviert.</div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
            <tr><td style="padding:16px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${imageCell}
                  <td class="stack stack-spec" valign="middle">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${specRows}</table>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="24" style="height:24px;font-size:1px;line-height:1px">&nbsp;</td></tr>
            <tr><td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr><td align="center" bgcolor="#16a34a" style="background:#16a34a;border-radius:10px;padding:15px 36px">
                  <a href="${offerLink || '#'}" target="_blank" style="${FONT}font-size:16px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block">Angebot ansehen</a>
                </td></tr>
              </table>
            </td></tr>
            <tr><td height="34" style="height:34px;font-size:1px;line-height:1px">&nbsp;</td></tr>
          </table>

          <div style="${FONT}margin:0 0 16px;font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#94a3b8">So geht es weiter</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${steps}</table>

          <div style="${FONT}margin:26px 0 0;font-size:13px;line-height:20px;color:#666666;text-align:center">Fragen oder Änderungswünsche? Einfach auf diese Mail antworten oder an <a href="mailto:info@neonframe.de" style="color:#0ea5e9;text-decoration:none">info@neonframe.de</a> schreiben.</div>

          <div style="${FONT}margin:26px 0 4px;font-size:15px;line-height:22px;color:#555555">Viele Grüße</div>
          <div style="${FONT}margin:0;font-size:15px;line-height:22px;font-weight:bold;color:#111111">Dein NeonFrame-Team</div>

        </td></tr>

        <tr><td align="center" bgcolor="#f8fafc" style="${FONT}background:#f8fafc;border-top:1px solid #eeeeee;padding:20px 36px;font-size:12px;line-height:18px;color:#aaaaaa;border-radius:0 0 16px 16px">
          <a href="https://neonframe.de" style="color:#0ea5e9;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#0ea5e9;text-decoration:none">info@neonframe.de</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
