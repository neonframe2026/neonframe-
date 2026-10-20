import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Admin "Verlauf" -> "Anschauen": zeigt die zuletzt verschickte Mail eines Typs an
//   /api/email-log?offerId=123&type=rabatt
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const offerId = searchParams.get('offerId')
  const type = searchParams.get('type')
  const page = (body) => new Response(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-Mail</title></head><body style="margin:0;font-family:Arial,sans-serif;background:#111;color:#ddd;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px">${body}</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  if (!offerId || !type) return page('Angebot oder Mail-Typ fehlt.')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ||    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
  const { data, error } = await supabase.from('email_log').select('html, subject, recipient, sent_at').eq('offer_id', offerId).eq('type', type).order('sent_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return page('Fehler: ' + error.message)
  if (!data) return page('Für diese Mail ist keine Kopie gespeichert.<br><br>Mails werden erst seit dem Update gespeichert –<br>ältere Mails kann man leider nicht anschauen.')
  const when = new Date(data.sent_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const bar = `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;background:#0b1321;color:#cbd5e1;padding:10px 16px;border-bottom:2px solid #22d3ee"><b style="color:#fff">${esc(data.subject)}</b><br>An: ${esc(data.recipient)} · Gesendet: ${when} Uhr</div>`
  const html = /<body[^>]*>/i.test(data.html) ? data.html.replace(/<body([^>]*)>/i, `<body$1>${bar}`) : bar + data.html
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
