import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { id, reason, comment } = await req.json()
    if (!id || !reason) {
      return Response.json({ error: 'Angaben fehlen' }, { status: 400 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: offer, error } = await supabase
      .from('offers')
      .update({
        unsubscribed: true,
        status: 'unsubscribed',
        unsubscribe_reason: String(reason).slice(0, 100),
        unsubscribe_comment: comment ? String(comment).slice(0, 1000) : null,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, custom_id, offer_num, project, customer_email, final_price')
      .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Benachrichtigung an dich
    if (process.env.RESEND_API_KEY) {
      const esc = s => String(s || '–').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
      const row = (l, v) => `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-weight:bold;white-space:nowrap">${l}</td><td style="padding:6px 0;color:#111">${v}</td></tr>`
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'NeonFrame Angebote <angebote@neonframe.de>',
          to: ['info@neonframe.de'],
          subject: `🔕 Abgemeldet – ${offer?.project || 'Kunde'} (Angebot #${offer?.custom_id || offer?.offer_num || id})`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111;max-width:560px">
            <h2 style="margin:0 0 12px;font-size:18px">Ein Kunde hat sich von Erinnerungen abgemeldet</h2>
            <table cellpadding="0" cellspacing="0" border="0">
              ${row('Kunde', esc(offer?.project))}
              ${row('E-Mail', esc(offer?.customer_email))}
              ${row('Angebot', '#' + esc(offer?.custom_id || offer?.offer_num || id))}
              ${row('Preis', offer?.final_price ? '€ ' + Number(offer.final_price).toFixed(2) : '–')}
              ${row('Grund', esc(reason))}
              ${comment ? row('Kommentar', esc(comment)) : ''}
            </table>
            <p style="margin:16px 0 0;color:#64748b;font-size:12px">An diesen Kunden werden keine Erinnerungen mehr verschickt.</p>
          </div>`,
        }),
      }).catch(e => console.error('Notify error:', e))
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
