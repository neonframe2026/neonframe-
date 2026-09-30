// Versand-Mails (alles Bilder) – genutzt von shopify-fulfillment und track-shipments
const EMAIL_ASSETS = 'https://angebote.neonframe.de/email'
const FONT = 'font-family:Arial,Helvetica,sans-serif;'

// Tracking-Link: Shopify-Link nehmen, sonst DHL-Suche (funktioniert für alle DHL-Nummern)
export function trackingLink(o) {
  if (o.tracking_url) return o.tracking_url
  const n = encodeURIComponent(o.tracking_number || '')
  if (!n) return 'https://neonframe.de'
  const c = String(o.tracking_company || 'DHL').toLowerCase()
  if (c.includes('dpd')) return `https://tracking.dpd.de/status/de_DE/parcel/${n}`
  if (c.includes('gls')) return `https://gls-group.com/DE/de/paketverfolgung?match=${n}`
  if (c.includes('ups')) return `https://www.ups.com/track?loc=de_DE&tracknum=${n}`
  if (c.includes('hermes')) return `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation#${n}`
  // DHL (Paket, Express, eCommerce) – die DHL-Suche findet alle Nummern
  return `https://www.dhl.com/de-de/home/tracking.html?tracking-id=${n}`
}

function img(file, alt, link) {
  const tag = `<img src="${EMAIL_ASSETS}/${file}" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;${FONT}font-size:16px;color:#ffffff">`
  return `<tr><td bgcolor="#09080a" style="background:#09080a;padding:0;font-size:0;line-height:0;mso-line-height-rule:exactly">${link ? `<a href="${link}" target="_blank" style="border:0;text-decoration:none">${tag}</a>` : tag}</td></tr>`
}

function wrap(preheader, rows) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:#09080a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#09080a">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09080a" style="background:#09080a">
    <tr><td align="center" style="padding:0">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${rows}
        ${img('kontakt.png', 'Noch Fragen? Antworte einfach auf diese E-Mail oder schreib an info@neonframe.de', 'mailto:info@neonframe.de')}
        <tr><td align="center" bgcolor="#09080a" style="${FONT}background:#09080a;padding:22px 20px;font-size:12px;line-height:18px;color:#4b5563">
          <a href="https://neonframe.de" style="color:#22d3ee;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#22d3ee;text-decoration:none">info@neonframe.de</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.replace(/>\s+</g, '><')
}

export function buildShippedEmail(o) {
  const link = trackingLink(o)
  const name = (o.project || '').split(' ')[0]
  return wrap(`Hallo ${name}, dein Neon-Schild ist fertig und jetzt auf dem Weg zu dir!`, `
    ${img('versand-1-header.jpg', 'Gute Nachrichten – dein Neon-Schild ist unterwegs', link)}
    ${img('versand-2-status.jpg', 'Status: Auf dem Weg zu dir nach Hause', link)}
    ${img('versand-3-tracking.jpg', 'Dein Schild ist auf dem Weg zu dir – Sendung verfolgen', link)}
    ${img('versand-4-status.jpg', 'Bestellung, Produktion und Versand erledigt – als Nächstes: Auspacken & Leuchten')}`)
}

export function buildTodayEmail(o) {
  const link = trackingLink(o)
  const name = (o.project || '').split(' ')[0]
  return wrap(`Hallo ${name}, heute ist es so weit – dein Neon-Schild wird heute zugestellt!`, `
    ${img('heute-1-header.jpg', 'Heute ist es so weit – dein Neon-Schild kommt heute', link)}
    ${img('heute-2-status.jpg', 'Status: In Zustellung – heute bei dir zu Hause', link)}
    ${img('heute-3-tracking.jpg', 'Dein Schild ist heute unterwegs zu dir – Sendung verfolgen', link)}
    ${img('heute-4-status.jpg', 'Bestellung, Produktion und Versand erledigt – heute: Auspacken & Leuchten')}`)
}

export async function sendMail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'NeonFrame <info@neonframe.de>', to: [to], subject, html }),
  })
  if (!res.ok) throw new Error('Mail-Versand fehlgeschlagen: ' + (await res.text()).slice(0, 200))
}

export const SUBJECT_SHIPPED = 'Dein Neon-Schild ist unterwegs 🚚'
export const SUBJECT_TODAY = 'Heute ist es so weit – dein Neon-Schild kommt heute! ✨'
