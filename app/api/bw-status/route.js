import { createClient } from '@supabase/supabase-js'
import { getBW, BW_PCT } from '../../../lib/blackweek'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Öffentlich (für den Shopify-Konfigurator): Läuft gerade die Black Week?
// Antwort: { active, pct, end } - keine Kundendaten
const ORIGINS = ['https://neonframe.de', 'https://www.neonframe.de', 'https://atcbcn-sh.myshopify.com']

export async function GET(req) {
  const origin = req.headers.get('origin') || ''
  const headers = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], Vary: 'Origin' }
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
    const bw = await getBW(sb)
    return Response.json({ active: !!bw.active, pct: BW_PCT, end: bw.end || null }, { headers })
  } catch {
    return Response.json({ active: false }, { headers })
  }
}
