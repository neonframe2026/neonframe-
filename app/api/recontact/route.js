import { createClient } from '@supabase/supabase-js'

const EMAIL_ASSETS = 'https://angebote.neonframe.de/email'
const FONT = "font-family:Arial,Helvetica,sans-serif;"

// Holt Bild, Maße, Farben, Ausführung und Rabatt direkt aus dem Angebot in Supabase
async function loadOffer(offerId) {
  try {
    if (!offerId) return null
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data } = await supabase
      .from('offers')
      .select('preview_image, width, height, colors, usage, disc_type, disc_val, status')
      .eq('id', offerId)
      .maybeSingle()
    return data || null
  } catch (e) {
    console.error('Offer lookup error:', e)
    return null
  }
}

export async function POST(req) {
  try {
    const { offerId, customerEmail, customerName, offerLink, width, height, colors } = await req.json()

    if (!customerEmail) {
      return Response.json({ error: 'Keine E-Mail-Adresse' }, { status: 400 })
    }

    const RESEND_KEY = process.env.RESEND_API_KEY
    if (!RESEND_KEY) {
      return Response.json({ error: 'E-Mail nicht konfiguriert' }, { status: 500 })
    }

    const offer = await loadOffer(offerId)
        if (offer?.status === 'unsubscribed') {
      return Response.json({ error: 'Dieser Kunde hat sich von Erinnerungen abgemeldet.' }, { status: 400 })
    }
    const unsubscribeUrl = `https://angebote.neonframe.de/abmelden/${offerId}`
    const imageUrl = offer?.preview_image && String(offer.preview_image).startsWith('http') ? offer.preview_image : null
    const discount = offer?.disc_type === 'pct' && parseFloat(offer?.disc_val) > 0 ? offer.disc_val : null

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NeonFrame <info@neonframe.de>',
        to: [customerEmail],
        subject: `Dein Angebot wartet noch auf dich – NeonFrame 💡`,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:info@neonframe.de?subject=Abmelden>` },
        html: buildRecontactEmail({
          firstName: customerName?.split(' ')[0] || 'dort',
          offerLink,
          unsubscribeUrl,
          imageUrl,
          discount,
          width: offer?.width || width,
          height: offer?.height || height,
          colors: offer?.colors || colors,
          variant: offer?.usage,
        }),
      }),
    })

    if (!emailRes.ok) {
      const err = await emailRes.text()
      console.error('Email error:', err)
      return Response.json({ error: 'E-Mail Versand fehlgeschlagen' }, { status: 500 })
    }

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

function buildRecontactEmail({ firstName, offerLink, unsubscribeUrl, imageUrl, discount, width, height, colors, variant }) {
  const colorText = Array.isArray(colors) ? colors.join(', ') : (colors || '')
  const sizeText = width && height ? `${width} × ${height} cm` : ''

  const specRows = [['Größe', sizeText], ['Ausführung', variant], ['Farben', colorText]]
    .filter(([, v]) => v)
    .map(([l, v]) => `<tr>
      <td width="100" valign="top" style="${FONT}padding:6px 0;font-size:14px;line-height:20px;font-weight:bold;color:#475569;width:100px">${l}:</td>
      <td valign="top" style="${FONT}padding:6px 0;font-size:14px;line-height:20px;color:#111111">${v}</td>
    </tr>`).join('')

  const imageCell = imageUrl ? `
    <td class="stack" width="160" valign="top" align="center" style="width:160px;padding:0 18px 0 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
        <tr><td align="center"><a href="${offerLink || '#'}" target="_blank" style="text-decoration:none;border:0"><img class="stack-img" src="${imageUrl}" width="140" alt="Deine Vorschau" style="display:block;width:140px;max-width:140px;height:auto;border:2px solid #0ea5e9;border-radius:10px;margin:0 auto"></a></td></tr>
        ${discount ? `<tr><td height="10" style="height:10px;font-size:1px;line-height:1px">&nbsp;</td></tr>
        <tr><td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
            <tr><td bgcolor="#10b981" style="${FONT}padding:5px 12px;font-size:12px;line-height:16px;font-weight:bold;color:#ffffff;border-radius:6px">${discount} % RABATT</td></tr>
          </table>
        </td></tr>` : ''}
      </table>
    </td>` : ''

  const tile = (icon, title, text, side) => `
    <td class="stack tile" width="50%" valign="top" style="width:50%;padding:${side === 'l' ? '0 6px 12px 0' : '0 0 12px 6px'}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
        <tr><td style="${FONT}padding:16px">
          <div style="font-size:22px;line-height:26px">${icon}</div>
          <div style="${FONT}padding-top:8px;font-size:15px;line-height:20px;font-weight:bold;color:#111111">${title}</div>
          <div style="${FONT}padding-top:4px;font-size:13px;line-height:19px;color:#666666">${text}</div>
        </td></tr>
      </table>
    </td>`

  const tiles = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${tile('&#127912;', 'Individuell gefertigt', 'Dein Schild wird genau nach deinem Design hergestellt.', 'l')}
        ${tile('&#128666;', 'Kostenloser Versand', 'Sicher verpackt direkt zu dir nach Hause.', 'r')}
      </tr>
      <tr>
        ${tile('&#127873;', 'Alles inklusive', 'Fernbedienung, Dimmer, 3 m Kabel, Adapter und Montagematerial.', 'l')}
        ${tile('&#128172;', 'Persönlicher Support', 'Fragen? Wir sind direkt per E-Mail für dich da.', 'r')}
      </tr>
    </table>`

  const html = `<!DOCTYPE html>
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
  .tile{padding:0 0 12px 0 !important}
  .stack-img{margin:0 auto 10px !important}
  .stack-spec{padding-top:12px !important}
}
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
          <div style="${FONT}margin:0 0 20px;font-size:15px;line-height:24px;color:#333333">vor Kurzem haben wir dir dein persönliches Angebot für dein Neon-Schild geschickt. Falls du noch nicht dazu gekommen bist: <strong>Dein Angebot ist weiterhin für dich reserviert.</strong><br><br>Hier noch einmal deine Konfiguration auf einen Blick:</div>

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
                <tr><td align="center" bgcolor="#0ea5e9" style="background:#0ea5e9;border-radius:12px;padding:18px 56px">
                  <a href="${offerLink || '#'}" target="_blank" style="${FONT}font-size:18px;line-height:22px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block"><span style="color:#ffffff;text-decoration:none">Angebot ansehen</span></a>
                </td></tr>
              </table>
            </td></tr>
            <tr><td height="34" style="height:34px;font-size:1px;line-height:1px">&nbsp;</td></tr>
          </table>

          <div style="${FONT}margin:0 0 16px;font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#94a3b8">Warum NeonFrame?</div>
          ${tiles}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="16" style="height:16px;mso-line-height-rule:exactly;line-height:16px;font-size:1px">&nbsp;</td></tr><tr><td style="padding:0;mso-line-height-rule:exactly;line-height:0;font-size:0"><a href="mailto:info@neonframe.de" style="text-decoration:none;border:0"><img src="${EMAIL_ASSETS}/kontakt.png" width="528" alt="Noch Fragen? Antworte einfach auf diese E-Mail oder schreib an info@neonframe.de" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:12px;${FONT}font-size:14px;line-height:20px;color:#111111"></a></td></tr></table>

          <div style="${FONT}margin:26px 0 4px;font-size:15px;line-height:22px;color:#555555">Viele Grüße</div>
          <div style="${FONT}margin:0;font-size:15px;line-height:22px;font-weight:bold;color:#111111">Dein NeonFrame-Team</div>

        </td></tr>

        <tr><td align="center" bgcolor="#f8fafc" style="${FONT}background:#f8fafc;border-top:1px solid #eeeeee;padding:20px 36px;font-size:12px;line-height:18px;color:#aaaaaa;border-radius:0 0 16px 16px">
          <a href="https://neonframe.de" style="color:#0ea5e9;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#0ea5e9;text-decoration:none">info@neonframe.de</a>
          <div style="${FONT}padding-top:12px;font-size:11px;line-height:17px;color:#aaaaaa">Du erhältst diese E-Mail, weil du bei NeonFrame ein Angebot angefragt hast.<br>Keine Erinnerungen mehr erhalten? <a href="${unsubscribeUrl}" target="_blank" style="color:#94a3b8;text-decoration:underline">Hier abmelden</a></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
  return html.replace(/>\s+</g, '><')
}
