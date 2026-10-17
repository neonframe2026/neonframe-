import { createClient } from '@supabase/supabase-js'
import { syncOfferShopify } from '../../../lib/shopify-admin'
import { logEmail } from '../../../lib/email-log'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Änderung von TNC in ein BESTEHENDES Angebot übernehmen
// GET  ?id=TNC-NUMMER        -> Vorher/Nachher anzeigen (speichert nichts)
// POST { id, notify: true }  -> Angebot + Shopify aktualisieren, Kunde bekommt Mail

const SITE = 'https://angebote.neonframe.de'
const r2 = n => Math.round(n * 100) / 100
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function load(req, id) {
  const { data: list } = await db().from('offers').select('*').eq('offer_num', String(id)).order('created_at', { ascending: false }).limit(1)
  const offer = list?.[0]
  if (!offer) throw new Error(`Kein Angebot mit TNC-Nummer ${id} gefunden`)
  const origin = new URL(req.url).origin
  const tnc = await (await fetch(`${origin}/api/tnc-import?id=${id}`, { cache: 'no-store' })).json()
  if (tnc.error) throw new Error(tnc.error)
  const rows = (tnc.size_options || []).filter(r => !r.disabled && r.vk > 0)
  const cur = tnc.current?.w ? tnc.current : tnc.min
  const row = rows.find(r => r.w === cur?.w) || rows[0]
  if (!row) throw new Error('Keine Preise von TNC erhalten')
  const next = {
    width: row.w, height: row.h, vk: row.vk, final: r2(row.vk * 1.10),
    colors: tnc.colors || offer.colors, backplate: tnc.backplate || offer.backplate, usage: tnc.usage || offer.usage,
    realistic_image: tnc.realistic_image || '', design_image: tnc.design_image || '',
    size_options: rows.filter(r => r.w !== row.w).map(r => ({ w: r.w, h: r.h, vk: r.vk })),
  }
  return { offer, next }
}

// TNC-Bild in den eigenen Speicher kopieren (damit es dauerhaft beim Kunden lädt)
async function copyImage(url, offerId, n) {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
    const path = `${offerId}-tnc-${n}-${Date.now()}.${ext}`
    const { error } = await db().storage.from('offer-images').upload(path, Buffer.from(await res.arrayBuffer()), { contentType: type, upsert: true })
    if (error) return null
    return db().storage.from('offer-images').getPublicUrl(path).data.publicUrl
  } catch { return null }
}

export async function GET(req) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return Response.json({ error: 'TNC-Nummer fehlt' }, { status: 400 })
    const { offer, next } = await load(req, id)
    return Response.json({
      before: {
        id: offer.id, custom_id: offer.custom_id, project: offer.project, customer_email: offer.customer_email, status: offer.status,
        width: offer.width, height: offer.height, colors: offer.colors, backplate: offer.backplate, usage: offer.usage,
        final: offer.final_price, images: [offer.preview_image, offer.preview_image_2, offer.preview_image_3].filter(Boolean),
      },
      after: next,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { id, notify } = await req.json()
    const { offer: o, next } = await load(req, id)

    // Preis wie bei der Größenauswahl: Endpreis = Empf. VK + 10 %, daraus Listenpreis netto zurückrechnen
    const dType = o.disc_type || 'pct'
    const dVal = parseFloat(o.disc_val) || 0
    const vat = 1 + (parseFloat(o.vat_pct) || 19) / 100
    const ex = (parseFloat(o.extra_disc_pct) || 0) / 100
    const base = Math.round((dType === 'pct' ? next.final / vat / (1 - dVal / 100) : next.final / vat + dVal) * 10000) / 10000
    const net = (dType === 'pct' ? base * (1 - dVal / 100) : Math.max(0, base - dVal)) * (1 - ex)

    const img1 = await copyImage(next.realistic_image, o.id, 1)
    const img2 = await copyImage(next.design_image, o.id, 2)
    const imgs = [img1, img2].filter(Boolean)

    const updated = {
      width: String(next.width), height: String(next.height),
      colors: next.colors, backplate: next.backplate, usage: next.usage,
      base_price: base, net_price: r2(net), final_price: r2(net * vat), rrp_price: r2(base * vat),
      size_options: next.size_options.length ? next.size_options : null,
      ...(imgs[0] ? { preview_image: imgs[0] } : {}),
      ...(imgs[1] ? { preview_image_2: imgs[1] } : {}),
      ...(imgs.length ? { checkout_image: null } : {}),
    }

    let ids = {}
    let shopifyError = null
    try {
      const shopImg = imgs[1] || imgs[0]
      ids = await syncOfferShopify({ ...o, ...updated }, shopImg ? { imageUrl: shopImg, refreshImage: true } : {})
    } catch (e) { shopifyError = e.message }

    const { error } = await db().from('offers').update({ ...updated, ...ids }).eq('id', o.id)
    if (error) throw new Error(error.message)

    let mailSent = false
    if (notify && o.customer_email && process.env.RESEND_API_KEY) {
      const link = `${SITE}/angebot/${o.custom_id || o.id}`
      const first = (o.project || '').split(' ')[0] || 'dort'
      const subject = 'Dein Angebot wurde angepasst 💡'
      const html = buildMail({ first, link, image: imgs[0] || imgs[1] || o.preview_image, size: `${next.width} × ${next.height} cm`, colors: next.colors, price: r2(net * vat) })
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'NeonFrame <info@neonframe.de>', to: [o.customer_email], subject, html }),
      })
      mailSent = res.ok
      if (res.ok) await logEmail(o.id, 'angebot_update', subject, html, o.customer_email)
    }

    return Response.json({ success: true, offerId: o.custom_id || o.id, mailSent, shopifyError })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

function buildMail({ first, link, image, size, colors, price }) {
  const F = 'font-family:Arial,Helvetica,sans-serif;'
  const eur = Number(price).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const spec = (l, v) => `<td align="center" style="${F}padding:12px 6px"><div style="${F}font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#22d3ee">${l}</div><div style="${F}padding-top:4px;font-size:14px;font-weight:bold;color:#ffffff">${v}</div></td>`
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09080a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09080a"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td style="${F}padding:8px 0 20px;font-size:22px;font-weight:bold;color:#ffffff">Neon<span style="color:#7fdcff">Frame</span></td></tr>
<tr><td style="${F}font-size:16px;line-height:24px;color:#e5e7eb;padding-bottom:18px">Hallo ${first},<br><br>wir haben dein Angebot nach deinen Wünschen angepasst. Schau es dir gerne in Ruhe an.</td></tr>
${image ? `<tr><td style="padding:0 0 0"><a href="${link}"><img src="${image}" width="600" alt="Deine neue Vorschau" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:12px 12px 0 0"></a></td></tr>` : ''}
<tr><td bgcolor="#111c2e" style="background:#111c2e;border-radius:${image ? '0 0 12px 12px' : '12px'}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${spec('Größe', size)}${spec('Farben', colors || '')}${spec('Preis', eur)}</tr></table></td></tr>
<tr><td align="center" style="padding:26px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#22d3ee" style="border-radius:10px"><a href="${link}" style="${F}display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#04101f;text-decoration:none">Angepasstes Angebot ansehen</a></td></tr></table>
</td></tr>
<tr><td style="${F}font-size:14px;line-height:22px;color:#9ca3af">Fragen oder noch ein Wunsch? Antworte einfach auf diese E-Mail.<br><br>Liebe Grüße<br>Phillip von NeonFrame</td></tr>
<tr><td align="center" style="${F}padding:28px 0 0;font-size:12px;color:#4b5563"><a href="https://neonframe.de" style="color:#22d3ee;text-decoration:none">neonframe.de</a> · info@neonframe.de</td></tr>
</table></td></tr></table></body></html>`.replace(/>\s+</g, '><')
}
