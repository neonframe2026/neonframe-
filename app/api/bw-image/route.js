import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { buildBwImage, bwImageHeight, BW_W } from '../../../lib/bw-image'
import { getBW, currentVk } from '../../../lib/blackweek'

// Persönliches Bild für die Black-Week-Mails
// /api/bw-image?offer=<id>&kind=switch|mail1|mail2
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const ASSETS = 'https://angebote.neonframe.de/email'
let fontCache = null
async function loadFonts() {
  if (fontCache) return fontCache
  const get = async f => { const r = await fetch(`${ASSETS}/${f}`); if (!r.ok) throw new Error(`Schrift fehlt: ${f}`); return r.arrayBuffer() }
  const [m4, m6, m8, a4] = await Promise.all(['montserrat-400.woff', 'montserrat-600.woff', 'montserrat-800.woff', 'anton-400.woff'].map(get))
  fontCache = [{ name: 'M', data: m4, weight: 400, style: 'normal' }, { name: 'M', data: m6, weight: 600, style: 'normal' }, { name: 'M', data: m8, weight: 800, style: 'normal' }, { name: 'A', data: a4, weight: 400, style: 'normal' }]
  return fontCache
}
async function loadPreview(url) {
  try {
    if (!url || !String(url).startsWith('http')) return null
    const r = await fetch(url)
    const type = (r.headers.get('content-type') || '').split(';')[0]
    if (!r.ok || !['image/jpeg', 'image/jpg', 'image/png'].includes(type)) return null
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`
  } catch { return null }
}
const pad = (n) => String(Math.max(0, n)).padStart(2, '0')

export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams
    const id = sp.get('offer')
    const kind = ['switch', 'mail1', 'mail2'].includes(sp.get('kind')) ? sp.get('kind') : 'mail1'
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
    let o = null
    if (/^\d+$/.test(id || '')) o = (await sb.from('offers').select('*').eq('id', id).maybeSingle()).data
    if (!o) o = (await sb.from('offers').select('*').eq('custom_id', id).maybeSingle()).data
    if (!o) return new Response('Angebot nicht gefunden', { status: 404 })

    const bw = await getBW(sb)
    const end = new Date(bw.end)
    const endText = `${end.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' })} um ${end.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} Uhr`
    const left = Math.max(0, end.getTime() - Date.now())
    const cd = { d: pad(Math.floor(left / 864e5)), h: pad(Math.floor(left / 36e5) % 24), m: pad(Math.floor(left / 6e4) % 60) }
    // Black-Week-Preise immer aus dem empf. VK (auch für Testmails mit normalen Angeboten)
    const vk = currentVk(o)
    const imageUrl = await loadPreview(o.preview_image)
    const el = buildBwImage({
      kind, firstName: (o.project || '').split(' ')[0] || 'dort', imageUrl,
      sizeText: o.width && o.height ? `${o.width} × ${o.height} cm` : '', variant: o.usage || '', colorText: o.colors || '',
      list: Math.round(vk / 0.6 * 100) / 100, now: vk, endText, cd,
    })
    const H = bwImageHeight(kind, !!imageUrl)
    const png = await new ImageResponse(el, { width: BW_W, height: H, fonts: await loadFonts() }).arrayBuffer()
    return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
  } catch (e) {
    return new Response('Fehler: ' + e.message, { status: 500 })
  }
}
