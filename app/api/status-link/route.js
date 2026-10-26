// Link aus der Shopify-Bestellbestätigung: /api/status-link?order={{ order.id }}&fb={{ order.order_status_url | url_encode }}
// Sucht das Angebot zur Shopify-Bestellung und leitet auf die Bestellstatus-Seite weiter
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const u = new URL(req.url)
  const order = String(u.searchParams.get('order') || '').replace(/\D/g, '')
  // Rückfall: Shopify-Bestellseite (nur Shopify/NeonFrame-Adressen erlaubt)
  let fb = 'https://neonframe.de'
  try { const f = new URL(u.searchParams.get('fb') || ''); if (/(^|\.)(neonframe\.de|shopify\.com|myshopify\.com)$/.test(f.hostname)) fb = f.toString() } catch {}
  if (!order) return Response.redirect(fb, 302)
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data } = await db.from('offers').select('offer_num, custom_id, id').eq('shopify_order_id', order).limit(1)
  const o = data?.[0]
  if (o?.offer_num) return Response.redirect(`${u.origin}/status/${o.offer_num}`, 302)
  if (o) return Response.redirect(`${u.origin}/angebot/${o.custom_id || o.id}`, 302)
  return Response.redirect(fb, 302)
}
