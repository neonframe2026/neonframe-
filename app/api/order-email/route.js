import { createClient } from '@supabase/supabase-js'

const EMAIL_ASSETS = 'https://angebote.neonframe.de/email'

// Produktions-Mail für ein Angebot verschicken (aus dem Admin, wenn Status auf "Bestellt" gestellt wird)
// Body: { offerId, delayMinutes = 15, force = false }
export async function POST(req) {
  try {
    const { offerId, delayMinutes = 15, force = false } = await req.json()
    if (!offerId) return Response.json({ error: 'offerId fehlt' }, { status: 400 })
    if (!process.env.RESEND_API_KEY) return Response.json({ error: 'E-Mail nicht konfiguriert' }, { status: 500 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: o, error } = await supabase.from('offers').select('id, project, customer_email, order_email_sent_at').eq('id', offerId).maybeSingle()
    if (error || !o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
    if (!o.customer_email) return Response.json({ error: 'Keine E-Mail hinterlegt' }, { status: 400 })
    if (o.order_email_sent_at && !force) return Response.json({ success: true, skipped: 'Produktions-Mail wurde schon verschickt' })

    const delay = Math.max(0, Number(delayMinutes) || 0)
    const sendAt = new Date(Date.now() + delay * 60 * 1000).toISOString()
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'NeonFrame <info@neonframe.de>',
        to: [o.customer_email],
        subject: 'Danke für deine Bestellung – dein Schild geht in Produktion ✨',
        ...(delay > 0 ? { scheduled_at: sendAt } : {}),
        html: buildOrderEmail(o.project?.split(' ')[0]),
      }),
    })
    if (!res.ok) return Response.json({ error: 'Versand fehlgeschlagen: ' + (await res.text()).slice(0, 200) }, { status: 500 })

    await supabase.from('offers').update({ order_email_sent_at: sendAt }).eq('id', o.id)
    return Response.json({ success: true, delay })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

function buildOrderEmail(firstName) {
  const img = (file, alt, link) => {
    const tag = `<img src="${EMAIL_ASSETS}/${file}" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;color:#ffffff">`
    return `<tr><td bgcolor="#09080a" style="background:#09080a;padding:0;margin:0;font-size:0;line-height:0;mso-line-height-rule:exactly">${link ? `<a href="${link}" style="border:0;text-decoration:none">${tag}</a>` : tag}</td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:#09080a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#09080a">Hallo ${firstName || ''}, danke für deine Bestellung! Dein Neon-Schild geht jetzt in Produktion.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09080a" style="background:#09080a">
    <tr><td align="center" style="padding:0">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${img('bestellung-1-danke.jpg', 'Danke für deine Bestellung – dein Schild geht in Produktion')}
        ${img('bestellung-2-ki-bild.jpg', 'Dein Neon-Schild wird von Hand gefertigt')}
        ${img('bestellung-3-ablauf.jpg', 'So geht es weiter: Produktion (4–6 Werktage), Versand mit Tracking-Link, Auspacken & Leuchten')}
        ${img('bestellung-4-vorteile.jpg', 'Handgefertigt, Premium-LEDs, Plug & Play, kostenloser Versand')}
        ${img('kontakt.png', 'Noch Fragen? Antworte einfach auf diese E-Mail oder schreib an info@neonframe.de', 'mailto:info@neonframe.de')}
        <tr><td align="center" bgcolor="#09080a" style="background:#09080a;padding:22px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280">
          <a href="https://neonframe.de" style="color:#22d3ee;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#22d3ee;text-decoration:none">info@neonframe.de</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.replace(/>\s+</g, '><')
}
