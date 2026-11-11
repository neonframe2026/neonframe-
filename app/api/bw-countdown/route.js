import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { buildCountdown, CD_H, BW_W } from '../../../lib/bw-image'
import { getBW } from '../../../lib/blackweek'

// Live-Countdown für die Black-Week-Mail: wird bei jedem Öffnen der Mail neu erzeugt
// /api/bw-countdown
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const ASSETS = 'https://angebote.neonframe.de/email'
let fontCache = null
async function loadFonts() {
  if (fontCache) return fontCache
  const get = async f => { const r = await fetch(`${ASSETS}/${f}`); if (!r.ok) throw new Error(`Schrift fehlt: ${f}`); return r.arrayBuffer() }
  const [m4, m8, a4] = await Promise.all(['montserrat-400.woff', 'montserrat-800.woff', 'anton-400.woff'].map(get))
  fontCache = [{ name: 'M', data: m4, weight: 400, style: 'normal' }, { name: 'M', data: m8, weight: 800, style: 'normal' }, { name: 'A', data: a4, weight: 400, style: 'normal' }]
  return fontCache
}
const pad = (n) => String(Math.max(0, n)).padStart(2, '0')

export async function GET() {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
    const bw = await getBW(sb)
    const end = new Date(bw.end)
    const endText = `${end.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' })} um ${end.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} Uhr`
    const left = Math.max(0, end.getTime() - Date.now())
    const cd = { d: pad(Math.floor(left / 864e5)), h: pad(Math.floor(left / 36e5) % 24), m: pad(Math.floor(left / 6e4) % 60) }
    const png = await new ImageResponse(buildCountdown({ cd, endText }), { width: BW_W, height: CD_H, fonts: await loadFonts() }).arrayBuffer()
    return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', Pragma: 'no-cache', Expires: '0' } })
  } catch (e) {
    return new Response('Fehler: ' + e.message, { status: 500 })
  }
}
