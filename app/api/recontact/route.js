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
      .select('preview_image, width, height, colors, usage, disc_type, disc_val, unsubscribed, status')
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
    if (offer?.unsubscribed || offer?.status === 'unsubscribed') {
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
          personalImageUrl: `https://angebote.neonframe.de/api/email-image?offer=${offerId}&type=recontact&v=${Date.now()}`,
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

function buildRecontactEmail({ personalImageUrl, firstName, offerLink, unsubscribeUrl, imageUrl, discount, width, height, colors, variant }) {
  const MID = '#0b1321'
  const colorText = Array.isArray(colors) ? colors.join(', ') : (colors || '')
  const sizeText = width && height ? `${width} × ${height} cm` : ''

  const specs = [['Größe', sizeText], ['Ausführung', variant], ['Farben', colorText]].filter(([, v]) => v)
  const specCols = specs.map(([l, v], i) => `
    <td valign="top" width="${Math.floor(100 / specs.length)}%" align="center" style="${FONT}padding:14px 8px;${i > 0 ? 'border-left:1px solid #1e3a4a;' : ''}">
      <div style="${FONT}font-size:11px;line-height:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#22d3ee">${l}</div>
      <div style="${FONT}padding-top:4px;font-size:14px;line-height:20px;font-weight:bold;color:#ffffff">${v}</div>
    </td>`).join('')

  const previewCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#111c2e" style="background:#111c2e;border:1px solid #1e3a4a;border-radius:14px;border-collapse:separate">
      ${imageUrl ? `<tr><td style="padding:0;font-size:0;line-height:0"><a href="${offerLink || '#'}" target="_blank" style="border:0;text-decoration:none"><img src="${imageUrl}" width="510" alt="Deine Vorschau" style="display:block;width:100%;max-width:510px;height:auto;border:0;border-radius:13px 13px 0 0"></a></td></tr>` : ''}
      <tr><td style="padding:0${imageUrl ? ';border-top:1px solid #1e3a4a' : ''}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${specCols}</tr></table>
      </td></tr>
      ${discount ? `<tr><td align="center" style="padding:0 0 14px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#10b981" style="${FONT}padding:5px 12px;font-size:12px;line-height:16px;font-weight:bold;color:#ffffff;border-radius:6px">${discount} % RABATT</td>
        </tr></table>
      </td></tr>` : ''}
    </table>`

  const img = (file, alt, link) => {
    const tag = `<img src="${EMAIL_ASSETS}/${file}" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;${FONT}font-size:16px;color:#ffffff">`
    return `<tr><td bgcolor="#09080a" style="background:#09080a;padding:0;font-size:0;line-height:0;mso-line-height-rule:exactly">${link ? `<a href="${link}" style="border:0;text-decoration:none">${tag}</a>` : tag}</td></tr>`
  }

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
  .pad{padding:8px 20px 24px !important}
  .stack{display:block !important;width:100% !important;padding:0 !important}
  .stack-img{margin:0 auto 10px !important}
  .stack-spec{padding-top:12px !important}
}
</style>
</head>
<body style="margin:0;padding:0;background:#09080a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#09080a">Hallo ${firstName}, dein persönliches Angebot ist weiterhin für dich reserviert.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09080a" style="background:#09080a">
    <tr><td align="center" style="padding:0">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">

        ${img('recontact-1-header.jpg', 'NeonFrame – Dein Neon-Schild wartet noch auf dich')}

        <tr><td bgcolor="${MID}" style="background:${MID};padding:0;font-size:0;line-height:0;mso-line-height-rule:exactly">
          <a href="${offerLink || '#'}" target="_blank" style="border:0;text-decoration:none"><img src="${personalImageUrl}" width="600" alt="Hallo ${firstName}, dein Angebot ansehen" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;${FONT}font-size:16px;color:#ffffff"></a>
        </td></tr>

        ${img('recontact-2-vorteile.jpg', 'Warum NeonFrame? Individuell gefertigt, kostenloser Versand, alles inklusive, persönlicher Support')}
        ${img('kontakt.png', 'Noch Fragen? Antworte einfach auf diese E-Mail oder schreib an info@neonframe.de', 'mailto:info@neonframe.de')}

        <tr><td align="center" bgcolor="#09080a" style="${FONT}background:#09080a;padding:22px 20px;font-size:12px;line-height:18px;color:#4b5563">
          <a href="https://neonframe.de" style="color:#22d3ee;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#22d3ee;text-decoration:none">info@neonframe.de</a>
          <div style="${FONT}padding-top:12px;font-size:11px;line-height:17px;color:#4b5563">Du erhältst diese E-Mail, weil du bei NeonFrame ein Angebot angefragt hast.<br>Keine Erinnerungen mehr erhalten? <a href="${unsubscribeUrl}" target="_blank" style="color:#6b7280;text-decoration:underline">Hier abmelden</a></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
  return html.replace(/>\s+</g, '><')
}
