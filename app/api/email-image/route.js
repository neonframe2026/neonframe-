import { ImageResponse } from 'next/og'
import { createElement as h } from 'react'
import { createClient } from '@supabase/supabase-js'

// Erzeugt für jedes Angebot ein persönliches Bild für die Mails
// Aufruf: /api/email-image?offer=<id>&type=recontact | discount
export const runtime = 'nodejs'

const ASSETS = 'https://angebote.neonframe.de/email'
const MID = '#0b1321'
const W = 1200

let fontCache = null
async function loadFonts() {
  if (fontCache) return fontCache
  const get = f => fetch(`${ASSETS}/${f}`).then(r => r.arrayBuffer())
  const [m4, m6, m8, a4] = await Promise.all([
    get('montserrat-400.woff'), get('montserrat-600.woff'), get('montserrat-800.woff'), get('anton-400.woff'),
  ])
  fontCache = [
    { name: 'M', data: m4, weight: 400, style: 'normal' },
    { name: 'M', data: m6, weight: 600, style: 'normal' },
    { name: 'M', data: m8, weight: 800, style: 'normal' },
    { name: 'A', data: a4, weight: 400, style: 'normal' },
  ]
  return fontCache
}

export function buildImage({ type, H, firstName, imageUrl, sizeText, variant, colorText, discount, oldPct, newPct }) {
  const s = (style, ...children) => h('div', { style: { display: 'flex', ...style } }, ...children)
  const txt = (style, text) => h('div', { style: { display: 'flex', ...style } }, text)
  const white = { color: '#ffffff', fontWeight: 800 }

  // Fließtext mit fetten Teilen: jedes Wort ein eigenes Element, damit es sauber umbricht
  const rich = (parts, style = {}) => s({ flexWrap: 'wrap', ...style },
    ...parts.flatMap(([text, st]) => text.replace(/ %/g, '\u00a0%').split(' ').filter(Boolean).map(w => txt({ marginRight: 8, ...(st || {}) }, w))))

  const paragraph = type === 'discount'
    ? [
        rich([['unsere Produktion hat in den kommenden Tagen noch etwas Luft. Statt sie leer stehen zu lassen, geben wir dir lieber einen besseren Preis.']]),
        rich([[`Auf deine bisherigen ${oldPct} % bekommst du`], [`noch einmal 10 % obendrauf – insgesamt also ${newPct} %.`, white], ['Den Rabatt haben wir schon direkt in deinem Angebot eingetragen.']], { marginTop: 30 }),
      ]
    : [
        rich([['vor Kurzem haben wir dir dein persönliches Angebot für dein Neon-Schild geschickt. Falls du noch nicht dazu gekommen bist:'], ['Dein Angebot ist weiterhin für dich reserviert.', white]]),
      ]

  const specs = [['GRÖSSE', sizeText], ['AUSFÜHRUNG', variant], ['FARBEN', colorText]].filter(([, v]) => v)

  return s({ width: W, height: H, flexDirection: 'column', flexShrink: 0, background: MID, padding: '16px 88px 0', fontFamily: 'M', color: '#cbd5e1' },
    txt({ fontSize: 44, fontWeight: 800, color: '#ffffff', marginBottom: 26 }, `Hallo ${firstName},`),
    s({ flexDirection: 'column', fontSize: 30, lineHeight: 1.6 }, ...paragraph),

    // Vorschau-Karte
    s({ flexDirection: 'column', marginTop: 48, border: '2px solid #1e3a4a', borderRadius: 28, background: '#111c2e', overflow: 'hidden' },
      imageUrl
        ? h('img', { src: imageUrl, width: 1020, height: 574, style: { width: 1020, height: 574, objectFit: 'cover' } })
        : null,
      s({ borderTop: imageUrl ? '2px solid #1e3a4a' : 'none' },
        ...specs.map(([l, v], i) => s({ flex: 1, flexDirection: 'column', alignItems: 'center', padding: '26px 14px', borderLeft: i ? '2px solid #1e3a4a' : 'none' },
          txt({ fontSize: 21, fontWeight: 800, letterSpacing: 3, color: '#22d3ee' }, l),
          txt({ fontSize: 28, fontWeight: 800, color: '#ffffff', marginTop: 8, textAlign: 'center' }, v)))),
      discount
        ? s({ justifyContent: 'center', paddingBottom: 26 },
            txt({ background: '#10b981', color: '#ffffff', fontSize: 24, fontWeight: 800, padding: '10px 24px', borderRadius: 12 }, `${discount} % RABATT`))
        : null),

    // Button
    s({ justifyContent: 'center', marginTop: 52 },
      txt({ background: '#0ea5e9', color: '#ffffff', fontSize: 36, fontWeight: 800, padding: '36px 110px', borderRadius: 24, boxShadow: '0 0 40px rgba(14,165,233,0.45)' }, 'Angebot ansehen')),
  )
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('offer')
    const type = searchParams.get('type') === 'discount' ? 'discount' : 'recontact'
    if (!id) return new Response('offer fehlt', { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        let { data: o } = await supabase.from('offers').select('*').eq('custom_id', id).maybeSingle()
    if (!o && /^\d+$/.test(id)) o = (await supabase.from('offers').select('*').eq('id', id).maybeSingle()).data
    if (!o) return new Response('Angebot nicht gefunden', { status: 404 })

    const base = parseFloat(o.base_price) || 0
    const amt = o.disc_type === 'pct' ? base * (parseFloat(o.disc_val) || 0) / 100 : (parseFloat(o.disc_val) || 0)
    const pct = base > 0 ? Math.round(amt / base * 100) : 0

    const H = type === 'discount' ? 1500 : 1330
    const img = buildImage({
      type, H,
      firstName: (o.project || '').split(' ')[0] || 'dort',
      imageUrl: o.preview_image && String(o.preview_image).startsWith('http') ? o.preview_image : null,
      sizeText: o.width && o.height ? `${o.width} × ${o.height} cm` : '',
      variant: o.usage || '',
      colorText: o.colors || '',
      discount: pct > 0 ? pct : null,
      oldPct: Math.max(0, pct - 10),
      newPct: pct,
    })

    return new ImageResponse(img, {
      width: W, height: H, fonts: await loadFonts(),
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    })
  } catch (err) {
    return new Response('Fehler: ' + err.message, { status: 500 })
  }
}
