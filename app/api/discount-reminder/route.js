import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Rabatt-Erinnerung: 3 Tage nach der Rabatt-Mail, 1 Tag bevor der Extra-Rabatt abläuft
// Body: { offerId, offerLink, test }  (test = Testmodus im Admin, ohne 3-Tage-Sperre)
export async function POST(req) {
  try {
    const { offerId, offerLink, test } = await req.json()
    const RESEND_KEY = process.env.RESEND_API_KEY
    if (!RESEND_KEY) return Response.json({ error: 'E-Mail nicht konfiguriert' }, { status: 500 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: o } = await supabase.from('offers').select('*').eq('id', offerId).maybeSingle()
    if (!o) return Response.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
    if (!o.customer_email) return Response.json({ error: 'Keine E-Mail hinterlegt' }, { status: 400 })
    if (o.status === 'unsubscribed') return Response.json({ error: 'Kunde hat sich abgemeldet' }, { status: 400 })
    if (['confirmed', 'in_production', 'shipped', 'delivered'].includes(o.status)) return Response.json({ error: 'Angebot wurde schon bestellt' }, { status: 400 })
    if (!o.extra_discount_at) return Response.json({ error: 'Es wurde noch keine Rabatt-Mail gesendet' }, { status: 400 })
    const hours = (Date.now() - new Date(o.extra_discount_at).getTime()) / 3600000
    if (!test && hours < 72) return Response.json({ error: 'Erst 3 Tage nach der Rabatt-Mail möglich' }, { status: 400 })

    const until = o.discount_valid_until ? new Date(o.discount_valid_until) : new Date(new Date(o.extra_discount_at).getTime() + 4 * 86400000)
    const validUntil = until.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })
    const base = parseFloat(o.base_price) || 0
    const basePct = o.disc_type === 'pct' ? (parseFloat(o.disc_val) || 0) : (base > 0 ? Math.round((parseFloat(o.disc_val) || 0) / base * 100) : 0)
    const extra = parseFloat(o.extra_disc_pct) || 10
    const link = offerLink || `https://angebote.neonframe.de/angebot/${o.custom_id || o.id}`
    const unsubscribeUrl = `https://angebote.neonframe.de/abmelden/${o.id}`

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'NeonFrame <info@neonframe.de>',
        to: [o.customer_email],
        subject: 'Dein Extra-Rabatt endet morgen',
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:info@neonframe.de?subject=Abmelden>` },
        html: buildReminderEmail({ firstName: (o.project || '').split(' ')[0], extra, basePct, validUntil, offerLink: link, unsubscribeUrl }),
      }),
    })
    if (!r.ok) return Response.json({ error: 'E-Mail Versand fehlgeschlagen: ' + (await r.text()).slice(0, 150) }, { status: 500 })

    await supabase.from('offers').update({ discount_reminder_sent_at: new Date().toISOString() }).eq('id', o.id)
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

function buildReminderEmail({ firstName, extra, basePct, validUntil, offerLink, unsubscribeUrl }) {
  const p = 'margin:0 0 16px;'
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222;max-width:560px;padding:24px 20px">
<p style="${p}">Hallo ${firstName || ''},</p>
<p style="${p}">wir wollten dir nur kurz Bescheid geben: Wir schließen gerade die Planung für unsere nächste Produktionsrunde ab. Dein zusätzlicher Rabatt gilt deshalb nur noch bis <b>morgen, den ${validUntil}</b>.</p>
<p style="${p}">Wenn du dir den Preis noch sichern möchtest, findest du dein Angebot hier:<br><a href="${offerLink}" style="color:#0891b2">${offerLink}</a></p>
<p style="${p}">Möchtest du vorher noch etwas anpassen oder hast Fragen? Schreib uns einfach – wir helfen dir gerne weiter.</p>
<p style="margin:0 0 18px">Viele Grüße<br>Dein NeonFrame-Team</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 16px 0 0;vertical-align:middle"><img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" width="100" height="100" alt="NeonFrame" style="display:block;width:100px;height:100px;border-radius:12px;border:0"></td>
<td style="padding:0 0 0 16px;border-left:2px solid #22d3ee;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#444444;vertical-align:middle">
<b style="font-size:17px;color:#111111">NeonFrame</b><br>
📞 <a href="tel:+4917656197641" style="color:#444444;text-decoration:none">+49 176 56197641</a><br>
✉️ <a href="mailto:info@neonframe.de" style="color:#0891b2;text-decoration:none">info@neonframe.de</a><br>
🌐 <a href="https://neonframe.de" style="color:#0891b2;text-decoration:none">neonframe.de</a>
</td></tr></table>
<p style="margin:28px 0 0;font-size:11px;color:#999999">Keine weiteren Mails zu diesem Angebot? <a href="${unsubscribeUrl}" style="color:#999999">Hier abmelden</a></p>
</div></body></html>`
}
