import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const EMAIL_ASSETS = 'https://angebote.neonframe.de/email'
const DELAY_MINUTES = 15

// Shopify-Webhook "Bestellentwurfsaktualisierung" (draft_orders/update)
// Entwurf bezahlt -> Angebot auf "Bestellt" + Produktions-Mail 15 Min. später
export async function POST(request) {
  try {
    const raw = await request.text()

    // Echtheit prüfen (Signatur von Shopify)
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET
    const hmac = request.headers.get('x-shopify-hmac-sha256') || ''
    if (!secret) return Response.json({ error: 'SHOPIFY_WEBHOOK_SECRET fehlt' }, { status: 500 })
    const digest = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64')
    const ok = hmac.length === digest.length && crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest))
    if (!ok) return Response.json({ error: 'Ungültige Signatur' }, { status: 401 })

    const draft = JSON.parse(raw)
    if (draft.status !== 'completed') return Response.json({ skipped: 'Entwurf noch nicht abgeschlossen' })

    // Token aus dem Checkout-Link, z.B. .../invoices/abc123 -> abc123
    const token = String(draft.invoice_url || '').split('/invoices/')[1]?.split(/[/?#]/)[0]
    if (!token) return Response.json({ skipped: 'Kein Checkout-Link im Entwurf' })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: offers, error } = await supabase
      .from('offers')
      .update({ status: 'confirmed' })
      .ilike('checkout_url', `%${token}%`)
      .select('id, project, customer_email, order_email_sent_at')

    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Produktions-Mail nur EINMAL pro Angebot (Shopify schickt Webhooks manchmal doppelt)
    let scheduled = 0
    for (const o of offers || []) {
      const email = o.customer_email || draft.email || draft.customer?.email
      if (o.order_email_sent_at || !email || !process.env.RESEND_API_KEY) continue

      const sendAt = new Date(Date.now() + DELAY_MINUTES * 60 * 1000).toISOString()
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'NeonFrame <info@neonframe.de>',
          to: [email],
          subject: 'Danke für deine Bestellung – dein Schild geht in Produktion ✨',
          scheduled_at: sendAt,
          html: buildOrderEmail(o.project?.split(' ')[0]),
        }),
      })
      if (res.ok) {
        await supabase.from('offers').update({ order_email_sent_at: sendAt }).eq('id', o.id)
        scheduled++
      } else {
        console.error('Order email error:', await res.text())
      }
    }

    return Response.json({ success: true, updated: offers?.length || 0, scheduled })
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
        ${img('bestellung-3-ablauf.jpg', 'So geht es weiter: Produktion (2–4 Werktage), Versand mit Tracking-Link, Auspacken & Leuchten')}
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
